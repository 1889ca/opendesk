/** Contract: contracts/erasure/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { ErasureAttestation, RetentionPolicy } from '../contract.ts';

// --- Attestations ---

export async function insertAttestation(
  pool: Pool,
  attestation: ErasureAttestation,
): Promise<void> {
  await pool.query(
    `INSERT INTO erasure_attestations
       (id, doc_id, type, actor_id, legal_basis, details, hash, previous_hash, issued_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      attestation.id,
      attestation.docId,
      attestation.type,
      attestation.actorId,
      attestation.legalBasis,
      attestation.details,
      attestation.hash,
      attestation.previousHash,
      attestation.issuedAt,
    ],
  );
}

export async function getAttestationsForDocument(
  pool: Pool,
  documentId: string,
): Promise<ErasureAttestation[]> {
  const result = await pool.query(
    `SELECT id, doc_id, type, actor_id, legal_basis, details,
            hash, previous_hash, issued_at
     FROM erasure_attestations
     WHERE doc_id = $1
     ORDER BY issued_at DESC`,
    [documentId],
  );
  return result.rows.map(mapAttestationRow);
}

function mapAttestationRow(row: Record<string, unknown>): ErasureAttestation {
  return {
    id: row.id as string,
    docId: row.doc_id as string,
    type: row.type as ErasureAttestation['type'],
    actorId: row.actor_id as string,
    legalBasis: row.legal_basis as string,
    details: row.details as string,
    hash: row.hash as string,
    previousHash: row.previous_hash as string | null,
    issuedAt: row.issued_at instanceof Date
      ? row.issued_at.toISOString()
      : (row.issued_at as string),
  };
}

// --- Retention Policies ---

export async function insertPolicy(
  pool: Pool,
  policy: RetentionPolicy,
): Promise<void> {
  await pool.query(
    `INSERT INTO retention_policies (id, name, target, max_age_days, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [policy.id, policy.name, policy.target, policy.maxAgeDays, policy.enabled, policy.createdAt, policy.updatedAt],
  );
}

export async function listPolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    `SELECT id, name, target, max_age_days, enabled, created_at, updated_at
     FROM retention_policies
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapPolicyRow);
}

export async function deletePolicy(pool: Pool, policyId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM retention_policies WHERE id = $1',
    [policyId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getAutoPurgePolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    `SELECT id, name, target, max_age_days, enabled, created_at, updated_at
     FROM retention_policies
     WHERE enabled = true
     ORDER BY max_age_days ASC`,
  );
  return result.rows.map(mapPolicyRow);
}

function mapPolicyRow(row: Record<string, unknown>): RetentionPolicy {
  return {
    id: row.id as string,
    name: row.name as string,
    target: row.target as RetentionPolicy['target'],
    maxAgeDays: row.max_age_days as number,
    enabled: row.enabled as boolean,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at as string),
  };
}

// --- Retention Scan ---

export interface ScanMatch {
  documentId: string;
  title: string;
  documentType: string;
  updatedAt: string;
  ageDays: number;
}

export async function findDocumentsExceedingAge(
  pool: Pool,
  maxAgeDays: number,
  documentType: string,
): Promise<ScanMatch[]> {
  const typeFilter = documentType === '*' ? '' : 'AND document_type = $2';
  const params: unknown[] = [maxAgeDays];
  if (documentType !== '*') params.push(documentType);

  const result = await pool.query<{
    id: string;
    title: string;
    document_type: string;
    updated_at: Date;
    age_days: number;
  }>(
    `SELECT id, title, document_type, updated_at,
            EXTRACT(DAY FROM now() - updated_at)::integer AS age_days
     FROM documents
     WHERE updated_at < now() - ($1 || ' days')::interval
       ${typeFilter}
     ORDER BY updated_at ASC
     LIMIT 500`,
    params,
  );

  return result.rows.map((r) => ({
    documentId: r.id,
    title: r.title || 'Untitled',
    documentType: r.document_type,
    updatedAt: r.updated_at.toISOString(),
    ageDays: r.age_days,
  }));
}
