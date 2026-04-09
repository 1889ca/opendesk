/** Contract: contracts/observability/rules.md */

import type { Pool } from 'pg';
import type { AnomalyAlert } from '../contract.ts';

/** Insert a new anomaly alert. */
export async function insertAlert(pool: Pool, alert: AnomalyAlert): Promise<void> {
  await pool.query(
    `INSERT INTO anomaly_alerts
       (id, metric, content_type, value, threshold, severity,
        detection_type, message, created_at, acknowledged_at, acknowledged_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      alert.id,
      alert.metric,
      alert.contentType,
      alert.value,
      alert.threshold,
      alert.severity,
      alert.detectionType,
      alert.message,
      alert.createdAt,
      alert.acknowledgedAt,
      alert.acknowledgedBy,
    ],
  );
}

/** List alerts with optional severity filter, cursor-based pagination. */
export async function listAlerts(
  pool: Pool,
  opts: { severity?: string; acknowledged?: boolean; cursor?: string; limit?: number },
): Promise<AnomalyAlert[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (opts.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(opts.severity);
  }

  if (opts.acknowledged === true) {
    conditions.push(`acknowledged_at IS NOT NULL`);
  } else if (opts.acknowledged === false) {
    conditions.push(`acknowledged_at IS NULL`);
  }

  if (opts.cursor) {
    const cursorRow = await pool.query(
      `SELECT created_at, id FROM anomaly_alerts WHERE id = $1`,
      [opts.cursor],
    );
    if (cursorRow.rows.length > 0) {
      const { created_at, id } = cursorRow.rows[0];
      conditions.push(`(created_at, id) < ($${paramIndex++}, $${paramIndex++})`);
      params.push(created_at, id);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts.limit ?? 50;
  params.push(limit);

  const result = await pool.query(
    `SELECT id, metric, content_type, value, threshold, severity,
            detection_type, message, created_at, acknowledged_at, acknowledged_by
     FROM anomaly_alerts
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${paramIndex}`,
    params,
  );

  return result.rows.map(mapAlertRow);
}

/** Acknowledge an alert. */
export async function acknowledgeAlert(
  pool: Pool,
  id: string,
  userId: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE anomaly_alerts
     SET acknowledged_at = NOW(), acknowledged_by = $2
     WHERE id = $1 AND acknowledged_at IS NULL`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

function mapAlertRow(row: Record<string, unknown>): AnomalyAlert {
  return {
    id: row.id as string,
    metric: row.metric as AnomalyAlert['metric'],
    contentType: row.content_type as AnomalyAlert['contentType'],
    value: Number(row.value),
    threshold: Number(row.threshold),
    severity: row.severity as AnomalyAlert['severity'],
    detectionType: row.detection_type as AnomalyAlert['detectionType'],
    message: row.message as string,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    acknowledgedAt: row.acknowledged_at
      ? (row.acknowledged_at instanceof Date
          ? row.acknowledged_at.toISOString()
          : String(row.acknowledged_at))
      : null,
    acknowledgedBy: (row.acknowledged_by as string) ?? null,
  };
}
