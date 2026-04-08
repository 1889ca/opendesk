/** Contract: contracts/observability/rules.md */

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { MetricNameSchema, type AnomalyAlert, type Severity } from '../contract.ts';
import { getRollingStats, getRecentSamples } from './metric-store.ts';
import { insertAlert } from './alert-store.ts';

const ZSCORE_THRESHOLD = 3;
const RATE_OF_CHANGE_THRESHOLD = 2.0; // 200%
const ROLLING_WINDOW_MINUTES = 60;
const RATE_WINDOW_MINUTES = 10;
const MIN_SAMPLES_FOR_ZSCORE = 10;

/** Run anomaly detection across all registered metrics. */
export async function detectAnomalies(pool: Pool): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];
  const metrics = MetricNameSchema.options;

  for (const metric of metrics) {
    const zscoreAlerts = await detectZscoreAnomalies(pool, metric);
    const rateAlerts = await detectRateAnomalies(pool, metric);
    alerts.push(...zscoreAlerts, ...rateAlerts);
  }

  // Persist all new alerts
  for (const alert of alerts) {
    await insertAlert(pool, alert);
  }

  return alerts;
}

/** Z-score detection: flag values > 3 SD from rolling mean. */
async function detectZscoreAnomalies(
  pool: Pool,
  metric: string,
): Promise<AnomalyAlert[]> {
  const stats = await getRollingStats(pool, metric, ROLLING_WINDOW_MINUTES);
  if (stats.count < MIN_SAMPLES_FOR_ZSCORE || stats.stddev === 0) return [];

  const recent = await getRecentSamples(pool, metric, 5);
  const alerts: AnomalyAlert[] = [];

  for (const sample of recent) {
    const zscore = Math.abs(sample.value - stats.mean) / stats.stddev;
    if (zscore > ZSCORE_THRESHOLD) {
      alerts.push(createAlert(
        metric,
        sample.value,
        stats.mean + ZSCORE_THRESHOLD * stats.stddev,
        'zscore',
        classifySeverity(zscore),
        `Z-score ${zscore.toFixed(2)} exceeds threshold ${ZSCORE_THRESHOLD} for ${metric}`,
      ));
    }
  }

  return alerts;
}

/** Rate-of-change detection: flag > 200% increase in 5-minute window. */
async function detectRateAnomalies(
  pool: Pool,
  metric: string,
): Promise<AnomalyAlert[]> {
  const samples = await getRecentSamples(pool, metric, RATE_WINDOW_MINUTES);
  if (samples.length < 2) return [];

  const alerts: AnomalyAlert[] = [];
  const midpoint = Math.floor(samples.length / 2);
  const firstHalf = samples.slice(0, midpoint);
  const secondHalf = samples.slice(midpoint);

  const firstAvg = average(firstHalf.map((s) => s.value));
  const secondAvg = average(secondHalf.map((s) => s.value));

  if (firstAvg > 0) {
    const rateOfChange = (secondAvg - firstAvg) / firstAvg;
    if (rateOfChange > RATE_OF_CHANGE_THRESHOLD) {
      alerts.push(createAlert(
        metric,
        secondAvg,
        firstAvg * (1 + RATE_OF_CHANGE_THRESHOLD),
        'rate_of_change',
        rateOfChange > 5 ? 'critical' : 'warning',
        `Rate increase ${(rateOfChange * 100).toFixed(0)}% exceeds ${RATE_OF_CHANGE_THRESHOLD * 100}% threshold for ${metric}`,
      ));
    }
  }

  return alerts;
}

function classifySeverity(zscore: number): Severity {
  if (zscore > 5) return 'critical';
  if (zscore > 4) return 'warning';
  return 'info';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function createAlert(
  metric: string,
  value: number,
  threshold: number,
  detectionType: 'zscore' | 'rate_of_change',
  severity: Severity,
  message: string,
): AnomalyAlert {
  // Derive contentType from metric name prefix
  const prefix = metric.split('.')[0];
  const contentTypeMap: Record<string, AnomalyAlert['contentType']> = {
    document: 'document',
    sheet: 'sheet',
    slides: 'slides',
    kb: 'kb',
  };

  return {
    id: randomUUID(),
    metric: metric as AnomalyAlert['metric'],
    contentType: contentTypeMap[prefix] ?? 'document',
    value,
    threshold,
    severity,
    detectionType,
    message,
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
}
