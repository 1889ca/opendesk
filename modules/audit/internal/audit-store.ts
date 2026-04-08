/** Contract: contracts/audit/rules.md */

import type { Pool } from 'pg';
import type { AuditEntry } from '../contract.ts';

/** Insert a new audit entry (append-only). */
export async function appendEntry(pool: Pool, entry: AuditEntry): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.id,
      entry.eventId,
      entry.documentId,
      entry.actorId,
      entry.actorType,
      entry.action,
      entry.hash,
      entry.previousHash,
      entry.occurredAt,
    ],
  );
}

/** Get the most recent audit entry for a document. */
export async function getLatestForDocument(
  pool: Pool,
  documentId: string,
): Promise<AuditEntry | null> {
  const result = await pool.query(
    `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
     FROM audit_log
     WHERE document_id = $1
     ORDER BY occurred_at DESC, id DESC
     LIMIT 1`,
    [documentId],
  );
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

/** Cursor-based paginated log (newest first). */
export async function getLog(
  pool: Pool,
  documentId: string,
  cursor?: string,
  limit = 50,
): Promise<AuditEntry[]> {
  if (cursor) {
    const cursorRow = await pool.query(
      `SELECT occurred_at, id FROM audit_log WHERE id = $1`,
      [cursor],
    );
    if (cursorRow.rows.length === 0) return [];
    const { occurred_at, id } = cursorRow.rows[0];

    const result = await pool.query(
      `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
       FROM audit_log
       WHERE document_id = $1
         AND (occurred_at, id) < ($2, $3)
       ORDER BY occurred_at DESC, id DESC
       LIMIT $4`,
      [documentId, occurred_at, id, limit],
    );
    return result.rows.map(mapRow);
  }

  const result = await pool.query(
    `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
     FROM audit_log
     WHERE document_id = $1
     ORDER BY occurred_at DESC, id DESC
     LIMIT $2`,
    [documentId, limit],
  );
  return result.rows.map(mapRow);
}

/** Get full chain in chronological order (for verification). */
export async function getFullChain(
  pool: Pool,
  documentId: string,
): Promise<AuditEntry[]> {
  const result = await pool.query(
    `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
     FROM audit_log
     WHERE document_id = $1
     ORDER BY occurred_at ASC, id ASC`,
    [documentId],
  );
  return result.rows.map(mapRow);
}

/** Map a PG row (snake_case) to AuditEntry (camelCase). */
function mapRow(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    documentId: row.document_id as string,
    actorId: row.actor_id as string,
    actorType: row.actor_type as 'human' | 'agent' | 'system',
    action: row.action as string,
    hash: row.hash as string,
    previousHash: (row.previous_hash as string) ?? null,
    occurredAt: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : (row.occurred_at as string),
  };
}
