/** Contract: contracts/observability/rules.md */

import type { Pool } from 'pg';
import type { ForensicsQuery, ForensicsEvent } from '../contract.ts';

/** Query forensics events with multi-dimensional filtering. */
export async function queryForensics(
  pool: Pool,
  query: ForensicsQuery,
): Promise<ForensicsEvent[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (query.contentType) {
    conditions.push(`content_type = $${paramIndex++}`);
    params.push(query.contentType);
  }

  if (query.actorId) {
    conditions.push(`actor_id = $${paramIndex++}`);
    params.push(query.actorId);
  }

  if (query.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(query.action);
  }

  if (query.from) {
    conditions.push(`occurred_at >= $${paramIndex++}`);
    params.push(query.from);
  }

  if (query.to) {
    conditions.push(`occurred_at <= $${paramIndex++}`);
    params.push(query.to);
  }

  if (query.cursor) {
    const cursorRow = await pool.query(
      `SELECT occurred_at, id FROM forensics_events WHERE id = $1`,
      [query.cursor],
    );
    if (cursorRow.rows.length > 0) {
      const { occurred_at, id } = cursorRow.rows[0];
      conditions.push(`(occurred_at, id) < ($${paramIndex++}, $${paramIndex++})`);
      params.push(occurred_at, id);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit ?? 50;
  params.push(limit);

  const result = await pool.query(
    `SELECT id, event_type, content_type, actor_id, actor_type,
            action, resource_id, occurred_at, metadata
     FROM forensics_events
     ${where}
     ORDER BY occurred_at DESC, id DESC
     LIMIT $${paramIndex}`,
    params,
  );

  return result.rows.map(mapForensicsRow);
}

/** Insert a forensics event (derived from domain events). */
export async function insertForensicsEvent(
  pool: Pool,
  event: ForensicsEvent,
): Promise<void> {
  await pool.query(
    `INSERT INTO forensics_events
       (id, event_type, content_type, actor_id, actor_type,
        action, resource_id, occurred_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.eventType,
      event.contentType,
      event.actorId,
      event.actorType,
      event.action,
      event.resourceId,
      event.occurredAt,
      event.metadata ?? {},
    ],
  );
}

/** Get all events for a specific user within a time window. */
export async function getUserActivity(
  pool: Pool,
  actorId: string,
  from: string,
  to: string,
): Promise<ForensicsEvent[]> {
  const result = await pool.query(
    `SELECT id, event_type, content_type, actor_id, actor_type,
            action, resource_id, occurred_at, metadata
     FROM forensics_events
     WHERE actor_id = $1
       AND occurred_at >= $2
       AND occurred_at <= $3
     ORDER BY occurred_at DESC`,
    [actorId, from, to],
  );

  return result.rows.map(mapForensicsRow);
}

function mapForensicsRow(row: Record<string, unknown>): ForensicsEvent {
  return {
    id: row.id as string,
    eventType: row.event_type as string,
    contentType: row.content_type as ForensicsEvent['contentType'],
    actorId: row.actor_id as string,
    actorType: row.actor_type as ForensicsEvent['actorType'],
    action: row.action as string,
    resourceId: row.resource_id as string,
    occurredAt: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : String(row.occurred_at),
    metadata: row.metadata as Record<string, unknown> | undefined,
  };
}
