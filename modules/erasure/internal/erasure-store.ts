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
       (id, document_id, actor_id, actor_type, reason, pre_state_hash, post_state_hash, state_changed, yjs_size_before, yjs_size_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      attestation.id,
      attestation.documentId,
      attestation.actorId,
      attestation.actorType,
      attestation.reason,
      attestation.preStateHash,
      attestation.postStateHash,
      attestation.stateChanged,
      attestation.yjsSizeBefore,
      attestation.yjsSizeAfter,
    ],
  );
}

export async function getAttestationsForDocument(
  pool: Pool,
  documentId: string,
): Promise<ErasureAttestation[]> {
  const result = await pool.query(
    `SELECT id, document_id, actor_id, actor_type, reason,
            pre_state_hash, post_state_hash, state_changed,
            yjs_size_before, yjs_size_after, created_at
     FROM erasure_attestations
     WHERE document_id = $1
     ORDER BY created_at DESC`,
    [documentId],
  );
  return result.rows.map(mapAttestationRow);
}

function mapAttestationRow(row: Record<string, unknown>): ErasureAttestation {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    actorId: row.actor_id as string,
    actorType: row.actor_type as 'human' | 'agent' | 'system',
    reason: row.reason as string,
    preStateHash: row.pre_state_hash as string,
    postStateHash: row.post_state_hash as string,
    stateChanged: row.state_changed as boolean,
    yjsSizeBefore: row.yjs_size_before as number,
    yjsSizeAfter: row.yjs_size_after as number,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
  };
}

// --- Retention Policies ---

export async function insertPolicy(
  pool: Pool,
  policy: RetentionPolicy,
): Promise<void> {
  await pool.query(
    `INSERT INTO retention_policies (id, name, document_type, max_age_days, auto_purge, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [policy.id, policy.name, policy.documentType, policy.maxAgeDays, policy.autoPurge, policy.createdBy],
  );
}

export async function listPolicies(pool: Pool): Promise<RetentionPolicy[]> {
  const result = await pool.query(
    `SELECT id, name, document_type, max_age_days, auto_purge, created_by, created_at
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
    `SELECT id, name, document_type, max_age_days, auto_purge, created_by, created_at
     FROM retention_policies
     WHERE auto_purge = true
     ORDER BY max_age_days ASC`,
  );
  return result.rows.map(mapPolicyRow);
}

function mapPolicyRow(row: Record<string, unknown>): RetentionPolicy {
  return {
    id: row.id as string,
    name: row.name as string,
    documentType: row.document_type as string,
    maxAgeDays: row.max_age_days as number,
    autoPurge: row.auto_purge as boolean,
    createdBy: row.created_by as string,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
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
