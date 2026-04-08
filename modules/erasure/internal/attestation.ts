/** Contract: contracts/erasure/rules.md */

import { createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { ErasureAttestation, ErasureType } from '../contract.ts';

/**
 * Compute an HMAC-SHA256 hash for an erasure attestation.
 * Format: id|docId|type|actorId|legalBasis|details|issuedAt|previousHash
 */
export function computeAttestationHash(
  fields: Omit<ErasureAttestation, 'hash'>,
  secret: string,
): string {
  const payload = [
    fields.id,
    fields.docId,
    fields.type,
    fields.actorId,
    fields.legalBasis,
    fields.details,
    fields.issuedAt,
    fields.previousHash ?? '',
  ].join('|');

  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Fetch the latest attestation for a document to chain hashes. */
export async function getLatestAttestation(
  pool: Pool,
  docId: string,
): Promise<ErasureAttestation | null> {
  const result = await pool.query(
    `SELECT * FROM erasure_attestations WHERE doc_id = $1 ORDER BY issued_at DESC LIMIT 1`,
    [docId],
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

/** Insert a new attestation record. */
export async function insertAttestation(
  pool: Pool,
  attestation: ErasureAttestation,
): Promise<void> {
  await pool.query(
    `INSERT INTO erasure_attestations (id, doc_id, type, actor_id, legal_basis, details, hash, previous_hash, issued_at)
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

/** Build and persist a chained erasure attestation. */
export async function createAttestation(
  pool: Pool,
  hmacSecret: string,
  docId: string,
  type: ErasureType,
  actorId: string,
  legalBasis: string,
  details: string,
): Promise<ErasureAttestation> {
  const latest = await getLatestAttestation(pool, docId);
  const previousHash = latest?.hash ?? null;

  const fields = {
    id: randomUUID(),
    docId,
    type,
    actorId,
    legalBasis,
    details,
    previousHash,
    issuedAt: new Date().toISOString(),
  };

  const hash = computeAttestationHash(fields, hmacSecret);
  const attestation: ErasureAttestation = { ...fields, hash };

  await insertAttestation(pool, attestation);
  return attestation;
}

function mapRow(row: Record<string, unknown>): ErasureAttestation {
  return {
    id: String(row.id),
    docId: String(row.doc_id),
    type: String(row.type) as ErasureType,
    actorId: String(row.actor_id),
    legalBasis: String(row.legal_basis),
    details: String(row.details),
    hash: String(row.hash),
    previousHash: row.previous_hash ? String(row.previous_hash) : null,
    issuedAt: String(row.issued_at),
  };
}
