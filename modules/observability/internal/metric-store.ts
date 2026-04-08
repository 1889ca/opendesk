/** Contract: contracts/observability/rules.md */

import type { Pool } from 'pg';
import type { MetricSample, TimeSeriesBucket } from '../contract.ts';

/** Insert a metric sample into the time-series table. */
export async function insertSample(pool: Pool, sample: MetricSample): Promise<void> {
  await pool.query(
    `INSERT INTO metric_samples (metric, content_type, value, timestamp, tags)
     VALUES ($1, $2, $3, $4, $5)`,
    [sample.metric, sample.contentType, sample.value, sample.timestamp, sample.tags ?? {}],
  );
}

/** Query aggregated time-series buckets for a metric. */
export async function queryBuckets(
  pool: Pool,
  metric: string,
  from: string,
  to: string,
  bucketSeconds = 300,
): Promise<TimeSeriesBucket[]> {
  const result = await pool.query(
    `SELECT
       date_trunc('second',
         to_timestamp(
           floor(extract(epoch FROM timestamp) / $4) * $4
         )
       ) AS bucket,
       metric,
       content_type,
       AVG(value) AS avg,
       MIN(value) AS min,
       MAX(value) AS max,
       COUNT(*)::int AS count
     FROM metric_samples
     WHERE metric = $1
       AND timestamp >= $2
       AND timestamp <= $3
     GROUP BY bucket, metric, content_type
     ORDER BY bucket ASC`,
    [metric, from, to, bucketSeconds],
  );

  return result.rows.map(mapBucketRow);
}

/** Get rolling stats for anomaly detection (last N minutes). */
export async function getRollingStats(
  pool: Pool,
  metric: string,
  windowMinutes = 60,
): Promise<{ mean: number; stddev: number; count: number }> {
  const result = await pool.query(
    `SELECT
       AVG(value) AS mean,
       STDDEV_POP(value) AS stddev,
       COUNT(*)::int AS count
     FROM metric_samples
     WHERE metric = $1
       AND timestamp >= NOW() - INTERVAL '1 minute' * $2`,
    [metric, windowMinutes],
  );

  const row = result.rows[0];
  return {
    mean: Number(row?.mean ?? 0),
    stddev: Number(row?.stddev ?? 0),
    count: Number(row?.count ?? 0),
  };
}

/** Get recent samples for rate-of-change detection. */
export async function getRecentSamples(
  pool: Pool,
  metric: string,
  windowMinutes = 10,
): Promise<{ value: number; timestamp: string }[]> {
  const result = await pool.query(
    `SELECT value, timestamp
     FROM metric_samples
     WHERE metric = $1
       AND timestamp >= NOW() - INTERVAL '1 minute' * $2
     ORDER BY timestamp ASC`,
    [metric, windowMinutes],
  );

  return result.rows.map((r: Record<string, unknown>) => ({
    value: Number(r.value),
    timestamp: r.timestamp instanceof Date
      ? r.timestamp.toISOString()
      : String(r.timestamp),
  }));
}

function mapBucketRow(row: Record<string, unknown>): TimeSeriesBucket {
  return {
    bucket: row.bucket instanceof Date
      ? row.bucket.toISOString()
      : String(row.bucket),
    metric: row.metric as TimeSeriesBucket['metric'],
    contentType: row.content_type as TimeSeriesBucket['contentType'],
    avg: Number(row.avg),
    min: Number(row.min),
    max: Number(row.max),
    count: Number(row.count),
  };
}
