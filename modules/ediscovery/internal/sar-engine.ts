/** Contract: contracts/ediscovery/rules.md */

import type { Pool } from 'pg';
import type { SarRequest, SarExportResult, DocumentSummary } from '../contract.ts';
import type { AuditEntry } from '../../audit/contract.ts';

/** Find all documents a user has access to (via grants). */
async function findUserDocuments(pool: Pool, userId: string): Promise<DocumentSummary[]> {
  const result = await pool.query(
    `SELECT d.id, d.title, d.document_type, g.role, d.created_at
     FROM grants g
     JOIN documents d ON d.id = g.resource_id
     WHERE g.principal_id = $1 AND g.resource_type = 'document'
     ORDER BY d.created_at DESC`,
    [userId],
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: (row.title as string) || 'Untitled',
    documentType: row.document_type as string,
    role: row.role as string,
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : (row.created_at as string),
  }));
}

/** Find all audit events involving a user. */
async function findUserAuditEvents(pool: Pool, userId: string): Promise<AuditEntry[]> {
  const result = await pool.query(
    `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
     FROM audit_log
     WHERE actor_id = $1
     ORDER BY occurred_at DESC`,
    [userId],
  );
  return result.rows.map(mapAuditRow);
}

/** Count Yjs update signatures by a user. */
async function countUserSignatures(pool: Pool, userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM yjs_update_signatures WHERE actor_id = $1`,
    [userId],
  );
  return (result.rows[0]?.count as number) ?? 0;
}

/** Execute a Subject Access Request export. */
export async function executeSarExport(
  pool: Pool,
  request: SarRequest,
): Promise<SarExportResult> {
  const [documents, auditEvents, signatureCount] = await Promise.all([
    findUserDocuments(pool, request.userId),
    findUserAuditEvents(pool, request.userId),
    countUserSignatures(pool, request.userId),
  ]);

  return {
    userId: request.userId,
    documents,
    auditEvents,
    signatureCount,
    exportedAt: new Date().toISOString(),
  };
}

function mapAuditRow(row: Record<string, unknown>): AuditEntry {
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
      ? (row.occurred_at as Date).toISOString()
      : (row.occurred_at as string),
  };
}
