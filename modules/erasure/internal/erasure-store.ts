/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import type { ErasureBridge, LegalHold } from '../contract.ts';

// --- Erasure Bridges ---

/** Insert an erasure bridge (append-only). */
export async function appendBridge(pool: Pool, bridge: ErasureBridge): Promise<void> {
  await pool.query(
    `INSERT INTO erasure_bridges
       (id, document_id, attestation_id, pre_erasure_hash, post_erasure_hash,
        legal_basis, jurisdiction, actor_id, bridge_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      bridge.id,
      bridge.documentId,
      bridge.attestationId,
      bridge.preErasureHash,
      bridge.postErasureHash,
      bridge.legalBasis,
      bridge.jurisdiction,
      bridge.actorId,
      bridge.bridgeHash,
      bridge.createdAt,
    ],
  );
}

/** Get all erasure bridges for a document, ordered by creation time. */
export async function getBridgesForDocument(
  pool: Pool,
  documentId: string,
): Promise<ErasureBridge[]> {
  const result = await pool.query(
    `SELECT id, document_id, attestation_id, pre_erasure_hash, post_erasure_hash,
            legal_basis, jurisdiction, actor_id, bridge_hash, created_at
     FROM erasure_bridges
     WHERE document_id = $1
     ORDER BY created_at ASC`,
    [documentId],
  );
  return result.rows.map(mapBridgeRow);
}

function mapBridgeRow(row: Record<string, unknown>): ErasureBridge {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    attestationId: row.attestation_id as string,
    preErasureHash: row.pre_erasure_hash as string,
    postErasureHash: row.post_erasure_hash as string,
    legalBasis: row.legal_basis as ErasureBridge['legalBasis'],
    jurisdiction: (row.jurisdiction as ErasureBridge['jurisdiction']) ?? null,
    actorId: row.actor_id as string,
    bridgeHash: row.bridge_hash as string,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
  };
}

// --- Legal Holds ---

/** Insert a new legal hold. */
export async function insertHold(pool: Pool, hold: LegalHold): Promise<void> {
  await pool.query(
    `INSERT INTO legal_holds
       (id, document_id, hold_type, authority, reason, actor_id, started_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      hold.id,
      hold.documentId,
      hold.holdType,
      hold.authority,
      hold.reason,
      hold.actorId,
      hold.startedAt,
      hold.expiresAt,
    ],
  );
}

/** Release a legal hold by setting released_at and released_by. */
export async function releaseHold(
  pool: Pool,
  holdId: string,
  releasedBy: string,
  releasedAt: string,
): Promise<LegalHold | null> {
  const result = await pool.query(
    `UPDATE legal_holds
     SET released_at = $1, released_by = $2
     WHERE id = $3 AND released_at IS NULL
     RETURNING id, document_id, hold_type, authority, reason, actor_id,
               started_at, expires_at, released_at, released_by`,
    [releasedAt, releasedBy, holdId],
  );
  return result.rows.length > 0 ? mapHoldRow(result.rows[0]) : null;
}

/** Get all active (non-released) holds for a document. */
export async function getActiveHolds(pool: Pool, documentId: string): Promise<LegalHold[]> {
  const result = await pool.query(
    `SELECT id, document_id, hold_type, authority, reason, actor_id,
            started_at, expires_at, released_at, released_by
     FROM legal_holds
     WHERE document_id = $1 AND released_at IS NULL
     ORDER BY started_at ASC`,
    [documentId],
  );
  return result.rows.map(mapHoldRow);
}

/** Get a single hold by ID. */
export async function getHoldById(pool: Pool, holdId: string): Promise<LegalHold | null> {
  const result = await pool.query(
    `SELECT id, document_id, hold_type, authority, reason, actor_id,
            started_at, expires_at, released_at, released_by
     FROM legal_holds WHERE id = $1`,
    [holdId],
  );
  return result.rows.length > 0 ? mapHoldRow(result.rows[0]) : null;
}

function mapHoldRow(row: Record<string, unknown>): LegalHold {
  const toIso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    return (v as string) ?? null;
  };
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    holdType: row.hold_type as LegalHold['holdType'],
    authority: row.authority as string,
    reason: (row.reason as string) ?? null,
    actorId: row.actor_id as string,
    startedAt: toIso(row.started_at) as string,
    expiresAt: toIso(row.expires_at),
    releasedAt: toIso(row.released_at),
    releasedBy: (row.released_by as string) ?? null,
  };
}
