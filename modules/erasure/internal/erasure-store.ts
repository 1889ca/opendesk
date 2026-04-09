/** Contract: contracts/erasure/rules.md */
import type { Pool } from 'pg';
import type { ErasureAttestation, RetentionPolicy, ErasureBridge, LegalHold } from '../contract.ts';

// --- Attestations ---

export async function insertAttestation(pool: Pool, attestation: ErasureAttestation): Promise<void> {
  await pool.query(
    `INSERT INTO erasure_attestations
       (id, doc_id, type, actor_id, legal_basis, details, hash, previous_hash, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [attestation.id, attestation.docId, attestation.type, attestation.actorId,
     attestation.legalBasis, attestation.details, attestation.hash,
     attestation.previousHash, attestation.issuedAt],
  );
}

export async function getAttestationsForDocument(pool: Pool, documentId: string): Promise<ErasureAttestation[]> {
  const result = await pool.query(
    `SELECT id, doc_id, type, actor_id, legal_basis, details, hash, previous_hash, issued_at
     FROM erasure_attestations WHERE doc_id = $1 ORDER BY issued_at DESC`,
    [documentId],
  );
  return result.rows.map(mapAttestationRow);
}

function mapAttestationRow(row: Record<string, unknown>): ErasureAttestation {
  return {
    id: row.id as string, docId: row.doc_id as string,
    type: row.type as ErasureAttestation['type'], actorId: row.actor_id as string,
    legalBasis: row.legal_basis as string, details: row.details as string,
    hash: row.hash as string, previousHash: row.previous_hash as string | null,
    issuedAt: row.issued_at instanceof Date ? row.issued_at.toISOString() : (row.issued_at as string),
  };
}

// --- Retention Policies ---

export async function insertPolicy(pool: Pool, policy: RetentionPolicy): Promise<void> {
  await pool.query(
    `INSERT INTO retention_policies (id, name, target, max_age_days, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [policy.id, policy.name, policy.target, policy.maxAgeDays, policy.enabled, policy.createdAt, policy.updatedAt],
  );
}

export async function listPolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    'SELECT id, name, target, max_age_days, enabled, created_at, updated_at FROM retention_policies ORDER BY created_at DESC',
  );
  return result.rows.map(mapPolicyRow);
}

export async function deletePolicy(pool: Pool, policyId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM retention_policies WHERE id = $1', [policyId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getAutoPurgePolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    'SELECT id, name, target, max_age_days, enabled, created_at, updated_at FROM retention_policies WHERE enabled = true ORDER BY max_age_days ASC',
  );
  return result.rows.map(mapPolicyRow);
}

function mapPolicyRow(row: Record<string, unknown>): RetentionPolicy {
  return {
    id: row.id as string, name: row.name as string,
    target: row.target as RetentionPolicy['target'],
    maxAgeDays: row.max_age_days as number, enabled: row.enabled as boolean,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at as string),
  };
}

// --- Retention Scan ---

export interface ScanMatch {
  documentId: string; title: string; documentType: string; updatedAt: string; ageDays: number;
}

export async function findDocumentsExceedingAge(
  pool: Pool, maxAgeDays: number, documentType: string,
): Promise<ScanMatch[]> {
  const typeFilter = documentType === '*' ? '' : 'AND document_type = $2';
  const params: unknown[] = [maxAgeDays];
  if (documentType !== '*') params.push(documentType);
  const result = await pool.query<{
    id: string; title: string; document_type: string; updated_at: Date; age_days: number;
  }>(
    `SELECT id, title, document_type, updated_at,
            EXTRACT(DAY FROM now() - updated_at)::integer AS age_days
     FROM documents WHERE updated_at < now() - ($1 || ' days')::interval ${typeFilter}
     ORDER BY updated_at ASC LIMIT 500`,
    params,
  );
  return result.rows.map((r) => ({
    documentId: r.id, title: r.title || 'Untitled', documentType: r.document_type,
    updatedAt: r.updated_at.toISOString(), ageDays: r.age_days,
  }));
}

// --- Erasure Bridges ---

export async function appendBridge(pool: Pool, bridge: ErasureBridge): Promise<void> {
  await pool.query(
    `INSERT INTO erasure_bridges
       (id, document_id, attestation_id, pre_erasure_hash, post_erasure_hash,
        legal_basis, jurisdiction, actor_id, bridge_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [bridge.id, bridge.documentId, bridge.attestationId, bridge.preErasureHash,
     bridge.postErasureHash, bridge.legalBasis, bridge.jurisdiction,
     bridge.actorId, bridge.bridgeHash, bridge.createdAt],
  );
}

export async function getBridgesForDocument(pool: Pool, documentId: string): Promise<ErasureBridge[]> {
  const result = await pool.query(
    `SELECT id, document_id, attestation_id, pre_erasure_hash, post_erasure_hash,
            legal_basis, jurisdiction, actor_id, bridge_hash, created_at
     FROM erasure_bridges WHERE document_id = $1 ORDER BY created_at ASC`,
    [documentId],
  );
  return result.rows.map(mapBridgeRow);
}

function mapBridgeRow(row: Record<string, unknown>): ErasureBridge {
  return {
    id: row.id as string, documentId: row.document_id as string,
    attestationId: row.attestation_id as string,
    preErasureHash: row.pre_erasure_hash as string,
    postErasureHash: row.post_erasure_hash as string,
    legalBasis: row.legal_basis as ErasureBridge['legalBasis'],
    jurisdiction: (row.jurisdiction as ErasureBridge['jurisdiction']) ?? null,
    actorId: row.actor_id as string, bridgeHash: row.bridge_hash as string,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string),
  };
}

// --- Legal Holds ---

export async function insertHold(pool: Pool, hold: LegalHold): Promise<void> {
  await pool.query(
    `INSERT INTO legal_holds
       (id, document_id, hold_type, authority, reason, actor_id, started_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [hold.id, hold.documentId, hold.holdType, hold.authority, hold.reason,
     hold.actorId, hold.startedAt, hold.expiresAt],
  );
}

export async function releaseHold(
  pool: Pool, holdId: string, releasedBy: string, releasedAt: string,
): Promise<LegalHold | null> {
  const result = await pool.query(
    `UPDATE legal_holds SET released_at = $1, released_by = $2
     WHERE id = $3 AND released_at IS NULL
     RETURNING id, document_id, hold_type, authority, reason, actor_id,
               started_at, expires_at, released_at, released_by`,
    [releasedAt, releasedBy, holdId],
  );
  return result.rows.length > 0 ? mapHoldRow(result.rows[0]) : null;
}

export async function getActiveHolds(pool: Pool, documentId: string): Promise<LegalHold[]> {
  const result = await pool.query(
    `SELECT id, document_id, hold_type, authority, reason, actor_id,
            started_at, expires_at, released_at, released_by
     FROM legal_holds WHERE document_id = $1 AND released_at IS NULL ORDER BY started_at ASC`,
    [documentId],
  );
  return result.rows.map(mapHoldRow);
}

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
    id: row.id as string, documentId: row.document_id as string,
    holdType: row.hold_type as LegalHold['holdType'],
    authority: row.authority as string, reason: (row.reason as string) ?? null,
    actorId: row.actor_id as string, startedAt: toIso(row.started_at) as string,
    expiresAt: toIso(row.expires_at), releasedAt: toIso(row.released_at),
    releasedBy: (row.released_by as string) ?? null,
  };
}
