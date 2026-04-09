/** Contract: contracts/observability/rules.md */
import type { Pool } from 'pg';
import type { MetricEntry, TimeSeriesPoint, MetricsFilter } from '../contract.ts';

/** Get time-series data bucketed by interval for charting. */
export async function getTimeSeriesData(
  pool: Pool,
  rangeMinutes: number,
  filter?: MetricsFilter,
): Promise<TimeSeriesPoint[]> {
  const bucketMinutes = rangeMinutes <= 60 ? 5 : rangeMinutes <= 360 ? 15 : 60;
  const params: unknown[] = [rangeMinutes, bucketMinutes];
  const conditions: string[] = [`timestamp > now() - ($1 || ' minutes')::interval`];

  if (filter?.operation) {
    params.push(filter.operation);
    conditions.push(`operation = $${params.length}`);
  }
  if (filter?.statusCode) {
    params.push(filter.statusCode);
    conditions.push(`status_code = $${params.length}`);
  }
  if (filter?.actorType) {
    params.push(filter.actorType);
    conditions.push(`actor_type = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const result = await pool.query<{
    bucket: string;
    request_count: string;
    error_count: string;
    avg_duration: number;
    p50_duration: number;
    p95_duration: number;
    p99_duration: number;
  }>(
    `SELECT
       date_trunc('minute', timestamp) - (EXTRACT(minute FROM timestamp)::int % $2) * interval '1 minute' AS bucket,
       COUNT(*)::text AS request_count,
       COUNT(*) FILTER (WHERE status_code >= 500)::text AS error_count,
       AVG(duration_ms) AS avg_duration,
       PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_duration,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration,
       PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration
     FROM metrics
     WHERE ${where}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    params,
  );

  return result.rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    requestCount: Number(r.request_count),
    errorCount: Number(r.error_count),
    avgDurationMs: Math.round(r.avg_duration * 100) / 100,
    p50DurationMs: Math.round(r.p50_duration * 100) / 100,
    p95DurationMs: Math.round(r.p95_duration * 100) / 100,
    p99DurationMs: Math.round(r.p99_duration * 100) / 100,
  }));
}

/** Search metrics by correlation ID. */
export async function searchByCorrelationId(
  pool: Pool,
  correlationId: string,
): Promise<MetricEntry[]> {
  const result = await pool.query<{
    id: string;
    correlation_id: string;
    service: string;
    operation: string;
    duration_ms: number;
    status_code: number | null;
    actor_id: string | null;
    actor_type: string | null;
    tags: Record<string, unknown>;
    timestamp: string;
  }>(
    `SELECT id, correlation_id, service, operation, duration_ms, status_code,
            actor_id, actor_type, tags, timestamp
     FROM metrics
     WHERE correlation_id = $1
     ORDER BY timestamp ASC
     LIMIT 100`,
    [correlationId],
  );

  return result.rows.map((r) => ({
    id: r.id,
    correlationId: r.correlation_id,
    service: r.service,
    operation: r.operation,
    durationMs: r.duration_ms,
    statusCode: r.status_code ?? undefined,
    actorId: r.actor_id ?? undefined,
    actorType: (r.actor_type as 'human' | 'agent' | 'system') ?? undefined,
    tags: r.tags,
    timestamp: new Date(r.timestamp).toISOString(),
  }));
}
