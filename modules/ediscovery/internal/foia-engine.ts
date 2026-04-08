/** Contract: contracts/ediscovery/rules.md */

import type { Pool } from 'pg';
import type { FoiaRequest, FoiaExportResult, VersionSummary } from '../contract.ts';
import type { AuditEntry } from '../../audit/contract.ts';
import { verifyDocumentSignatures } from '../../audit/internal/yjs-signatures.ts';

/** Fetch audit trail for a document within an optional date range. */
async function fetchAuditTrail(
  pool: Pool,
  documentId: string,
  startDate?: string,
  endDate?: string,
): Promise<AuditEntry[]> {
  const params: unknown[] = [documentId];
  let dateFilter = '';

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND occurred_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND occurred_at <= $${params.length}`;
  }

  const result = await pool.query(
    `SELECT id, event_id, document_id, actor_id, actor_type, action, hash, previous_hash, occurred_at
     FROM audit_log
     WHERE document_id = $1${dateFilter}
     ORDER BY occurred_at ASC, id ASC`,
    params,
  );
  return result.rows.map(mapAuditRow);
}

/** Fetch version snapshots for a document. */
async function fetchVersions(
  pool: Pool,
  documentId: string,
): Promise<VersionSummary[]> {
  const result = await pool.query(
    `SELECT id, title, version_number, created_by, created_at
     FROM versions
     WHERE document_id = $1
     ORDER BY version_number ASC`,
    [documentId],
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: (row.title as string) || '',
    versionNumber: row.version_number as number,
    createdBy: (row.created_by as string) || 'unknown',
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : (row.created_at as string),
  }));
}

/** Execute a FOIA-style document history export. */
export async function executeFoiaExport(
  pool: Pool,
  request: FoiaRequest,
): Promise<FoiaExportResult> {
  const startDate = request.startDate || '1970-01-01T00:00:00.000Z';
  const endDate = request.endDate || new Date().toISOString();

  const [auditTrail, versions, signatureVerification] = await Promise.all([
    fetchAuditTrail(pool, request.documentId, request.startDate, request.endDate),
    fetchVersions(pool, request.documentId),
    verifyDocumentSignatures(pool, request.documentId).catch(() => null),
  ]);

  return {
    documentId: request.documentId,
    dateRange: { start: startDate, end: endDate },
    auditTrail,
    versions,
    signatureVerification,
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
