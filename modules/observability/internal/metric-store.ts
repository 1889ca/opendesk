/** Contract: contracts/observability/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { MetricEntry, OperationSummary, HealthIndicator } from '../contract.ts';

export interface MetricStoreOptions {
  pool: Pool;
}

/** Insert a single metric row. Fire-and-forget — never throws. */
export async function insertMetric(
  pool: Pool,
  entry: Omit<MetricEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO metrics (id, correlation_id, service, operation, duration_ms, status_code, actor_id, actor_type, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      entry.correlationId,
      entry.service,
      entry.operation,
      entry.durationMs,
      entry.statusCode ?? null,
      entry.actorId ?? null,
      entry.actorType ?? null,
      JSON.stringify(entry.tags),
    ],
  );
}

/** Get per-operation aggregates for the last N minutes. */
export async function getOperationSummaries(
  pool: Pool,
  sinceMinutes = 15,
): Promise<OperationSummary[]> {
  const result = await pool.query<{
    operation: string;
    count: string;
    avg_duration: number;
    p95_duration: number;
    p99_duration: number;
    error_count: string;
  }>(
    `SELECT
       operation,
       COUNT(*)::text AS count,
       AVG(duration_ms) AS avg_duration,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration,
       PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration,
       COUNT(*) FILTER (WHERE status_code >= 500)::text AS error_count
     FROM metrics
     WHERE timestamp > now() - ($1 || ' minutes')::interval
     GROUP BY operation
     ORDER BY COUNT(*) DESC
     LIMIT 50`,
    [sinceMinutes],
  );

  return result.rows.map((r) => ({
    operation: r.operation,
    count: Number(r.count),
    avgDurationMs: Math.round(r.avg_duration * 100) / 100,
    p95DurationMs: Math.round(r.p95_duration * 100) / 100,
    p99DurationMs: Math.round(r.p99_duration * 100) / 100,
    errorCount: Number(r.error_count),
  }));
}

/** Insert a batch of health indicators. */
export async function insertHealthIndicators(
  pool: Pool,
  indicators: HealthIndicator[],
): Promise<void> {
  if (indicators.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const ind of indicators) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    values.push(randomUUID(), ind.name, ind.value, ind.unit ?? null, ind.status);
    idx += 5;
  }

  await pool.query(
    `INSERT INTO health_indicators (id, indicator_name, value, unit, status)
     VALUES ${placeholders.join(', ')}`,
    values,
  );
}

/** Get the latest value for each health indicator. */
export async function getLatestHealthIndicators(
  pool: Pool,
): Promise<HealthIndicator[]> {
  const result = await pool.query<{
    indicator_name: string;
    value: number;
    unit: string | null;
    status: string;
    timestamp: string;
  }>(
    `SELECT DISTINCT ON (indicator_name)
       indicator_name, value, unit, status, timestamp
     FROM health_indicators
     ORDER BY indicator_name, timestamp DESC`,
  );

  return result.rows.map((r) => ({
    name: r.indicator_name,
    value: r.value,
    unit: r.unit ?? undefined,
    status: r.status as 'ok' | 'warning' | 'critical',
    timestamp: new Date(r.timestamp).toISOString(),
  }));
}
