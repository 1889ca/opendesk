/** Contract: contracts/observability/rules.md */
import type { Pool } from 'pg';
import type { MetricEntry, MetricsSummary, HealthIndicator, TimeSeriesPoint, MetricsFilter, ObservabilityModule, MetricSample, AnomalyAlert, ForensicsQuery, ForensicsEvent, SiemFormat } from '../contract.ts';
import { insertMetric, getOperationSummaries, getLatestHealthIndicators } from './metric-store.ts';
import { getTimeSeriesData, searchByCorrelationId as searchCorrelation } from './metric-queries.ts';
import { createHealthMonitor } from './health-monitor.ts';
import { detectAnomalies as runAnomalyDetection } from './anomaly-detector.ts';
import { acknowledgeAlert as ackAlert } from './alert-store.ts';
import { queryForensics as queryForensicsStore } from './forensics-store.ts';
import { formatEvents } from './siem-formatter.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('observability');

export interface ObservabilityDependencies {
  pool: Pool;
  healthIntervalMs?: number;
}

const startTime = Date.now();

/**
 * Factory: create the observability module.
 * Metric writes are fire-and-forget to avoid blocking request processing.
 */
export function createObservability(deps: ObservabilityDependencies): ObservabilityModule {
  const { pool } = deps;
  const healthIntervalMs = deps.healthIntervalMs ?? 60_000;

  const monitor = createHealthMonitor({ pool, intervalMs: healthIntervalMs });

  function recordMetric(entry: Omit<MetricEntry, 'id' | 'timestamp'>): void {
    insertMetric(pool, entry).catch((err) => {
      log.error('failed to record metric', { error: String(err) });
    });
  }

  async function getSummary(): Promise<MetricsSummary> {
    const [operations, health] = await Promise.all([
      getOperationSummaries(pool),
      getLatestHealthIndicators(pool),
    ]);

    return {
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
      health,
      operations,
    };
  }

  async function getHealth(): Promise<HealthIndicator[]> {
    return getLatestHealthIndicators(pool);
  }

  async function getTimeSeries(rangeMinutes: number, filter?: MetricsFilter): Promise<TimeSeriesPoint[]> {
    return getTimeSeriesData(pool, rangeMinutes, filter);
  }

  async function searchByCorrelationId(correlationId: string): Promise<MetricEntry[]> {
    return searchCorrelation(pool, correlationId);
  }

  async function record(sample: MetricSample): Promise<void> {
    // Store metric sample — fire-and-forget style
    await pool.query(
      `INSERT INTO metric_samples (metric, content_type, value, timestamp, tags)
       VALUES ($1, $2, $3, $4, $5)`,
      [sample.metric, sample.contentType, sample.value, sample.timestamp, sample.tags ?? {}],
    );
  }

  async function queryTimeSeries(
    metric: string, from: string, to: string, bucketSeconds = 300,
  ): Promise<unknown[]> {
    const result = await pool.query(
      `SELECT date_trunc('second', timestamp) - (EXTRACT(epoch FROM timestamp)::int % $4) * interval '1 second' AS bucket,
              COUNT(*) AS count, AVG(value) AS avg_value
       FROM metric_samples
       WHERE metric = $1 AND timestamp >= $2 AND timestamp <= $3
       GROUP BY bucket ORDER BY bucket`,
      [metric, from, to, bucketSeconds],
    );
    return result.rows;
  }

  async function detectAnomalies(): Promise<AnomalyAlert[]> {
    return runAnomalyDetection(pool);
  }

  async function acknowledgeAlert(id: string, userId: string): Promise<void> {
    await ackAlert(pool, id, userId);
  }

  async function queryForensics(query: ForensicsQuery): Promise<ForensicsEvent[]> {
    return queryForensicsStore(pool, query);
  }

  async function exportSiem(format: SiemFormat, from: string, to: string): Promise<string> {
    const events = await queryForensicsStore(pool, { from, to, limit: 200 });
    return formatEvents(events, format);
  }

  return {
    recordMetric,
    record,
    getSummary,
    getHealth,
    getTimeSeries,
    queryTimeSeries,
    searchByCorrelationId,
    detectAnomalies,
    acknowledgeAlert,
    queryForensics,
    exportSiem,
    startHealthMonitor: () => monitor.start(),
    stopHealthMonitor: () => monitor.stop(),
  };
}
