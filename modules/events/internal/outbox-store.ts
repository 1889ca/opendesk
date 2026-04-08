/** Contract: contracts/events/rules.md */
import type { Pool, PoolClient } from 'pg';
import type { DomainEvent, OutboxEntry } from '../contract.ts';

/** Insert an event into the outbox within the caller's PG transaction. */
export async function insertOutboxEntry(
  client: PoolClient,
  event: DomainEvent,
): Promise<void> {
  await client.query(
    `INSERT INTO event_outbox (id, type, aggregate_id, revision_id, actor_id, actor_type, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.id,
      event.type,
      event.aggregateId,
      event.revisionId ?? null,
      event.actorId,
      event.actorType,
      event.occurredAt,
    ],
  );
}

/** Find events that have not yet been published to Redis Streams. */
export async function findUnpublished(
  pool: Pool,
  limit: number,
): Promise<OutboxEntry[]> {
  const result = await pool.query(
    `SELECT id, type, aggregate_id AS "aggregateId",
            revision_id AS "revisionId", actor_id AS "actorId",
            actor_type AS "actorType", occurred_at AS "occurredAt",
            published_at AS "publishedAt"
     FROM event_outbox
     WHERE published_at IS NULL
     ORDER BY occurred_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    ...row,
    occurredAt: (row.occurredAt as Date).toISOString(),
    publishedAt: row.publishedAt
      ? (row.publishedAt as Date).toISOString()
      : null,
  })) as OutboxEntry[];
}

/** Mark events as published after successful Redis Streams publish. */
export async function markPublished(
  pool: Pool,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `UPDATE event_outbox SET published_at = NOW() WHERE id IN (${placeholders})`,
    ids,
  );
}

/** Delete outbox entries older than the given number of days. */
export async function pruneOlderThan(
  pool: Pool,
  days: number,
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM event_outbox WHERE occurred_at < NOW() - $1::interval`,
    [`${days} days`],
  );
  return result.rowCount ?? 0;
}
