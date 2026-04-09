/** Contract: contracts/erasure/rules.md */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ErasureAttestation,
  RetentionPolicy,
  RetentionScanResult,
  PrunePreview,
  PruneResult,
} from '../contract.ts';
import { compactDocument } from '../../collab/index.ts';
import { loadYjsState, saveYjsState } from '../../storage/index.ts';
import {
  insertAttestation,
  getAttestationsForDocument,
  listPolicies as listPoliciesStore,
  getAutoPurgePolicies,
  findDocumentsExceedingAge,
} from './erasure-store.ts';
import { createLogger } from '../../logger/index.ts';

// Heavy lifters for the erasure module: the document-erasure flow
// (compact CRDT history → record HMAC-chained attestation) and the
// retention scan / preview / prune operations. Extracted from
// create-erasure.ts so the factory file stays under the 200-line
// limit (issue #136).

const log = createLogger('erasure');

/** SHA-256 hash of a Uint8Array for attestation fingerprints. */
export function hashState(state: Uint8Array | null): string {
  if (!state) return 'empty';
  return createHash('sha256').update(state).digest('hex');
}

/** Compute an HMAC-SHA256 hash for attestation chaining. */
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

export async function eraseDocument(
  pool: Pool,
  hmacSecret: string,
  documentId: string,
  actorId: string,
  _actorType: 'human' | 'agent' | 'system',
  reason: string,
): Promise<ErasureAttestation> {
  log.info('starting erasure', { documentId, actorId, reason });
  const currentState = await loadYjsState(documentId);
  const sizeBefore = currentState?.byteLength ?? 0;
  let sizeAfter: number;
  if (!currentState || currentState.byteLength === 0) {
    sizeAfter = 0;
  } else {
    const result = await compactDocument(documentId, currentState);
    await saveYjsState(documentId, result.compactedState);
    sizeAfter = result.compactedBytes;
  }
  const existing = await getAttestationsForDocument(pool, documentId);
  const previousHash = existing.length > 0 ? existing[0].hash : null;
  const fields = {
    id: randomUUID(),
    docId: documentId,
    type: 'redaction' as const,
    actorId,
    legalBasis: reason,
    details: `Erased document ${documentId}. Size: ${sizeBefore} -> ${sizeAfter} bytes.`,
    previousHash,
    issuedAt: new Date().toISOString(),
  };
  const hash = computeAttestationHash(fields, hmacSecret);
  const attestation: ErasureAttestation = { ...fields, hash };
  await insertAttestation(pool, attestation);
  log.info('erasure complete', { documentId, sizeBefore, sizeAfter });
  return attestation;
}

export async function scanRetention(pool: Pool): Promise<RetentionScanResult[]> {
  const policies = await listPoliciesStore(pool);
  const results: RetentionScanResult[] = [];
  for (const policy of policies) {
    const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
    results.push({ policy, matchedDocuments: matches });
  }
  return results;
}

export async function executeRetention(
  pool: Pool,
  hmacSecret: string,
  actorId: string,
): Promise<ErasureAttestation[]> {
  const policies = await getAutoPurgePolicies(pool);
  const attestations: ErasureAttestation[] = [];
  for (const policy of policies) {
    const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
    for (const doc of matches) {
      try {
        attestations.push(
          await eraseDocument(
            pool,
            hmacSecret,
            doc.documentId,
            actorId,
            'system',
            `Auto-purge: policy "${policy.name}" (${policy.maxAgeDays} days)`,
          ),
        );
      } catch (err) {
        log.error('auto-purge failed', { documentId: doc.documentId, error: String(err) });
      }
    }
  }
  return attestations;
}

async function findPolicy(pool: Pool, policyId: string): Promise<RetentionPolicy> {
  const policies = await listPoliciesStore(pool);
  const policy = policies.find((p) => p.id === policyId);
  if (!policy) throw new Error(`Policy ${policyId} not found`);
  return policy;
}

export async function previewPrune(pool: Pool, policyId: string): Promise<PrunePreview> {
  const policy = await findPolicy(pool, policyId);
  const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
  return {
    policyId,
    matchedEntries: matches.map((m) => ({
      id: m.documentId,
      type: policy.target,
      age: m.ageDays,
    })),
    wouldDelete: matches.length,
    dryRun: true as const,
  };
}

export async function executePrune(
  pool: Pool,
  hmacSecret: string,
  policyId: string,
  actorId: string,
): Promise<PruneResult> {
  const policy = await findPolicy(pool, policyId);
  const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
  const attestations: ErasureAttestation[] = [];
  for (const doc of matches) {
    attestations.push(
      await eraseDocument(
        pool,
        hmacSecret,
        doc.documentId,
        actorId,
        'system',
        `Prune: policy "${policy.name}"`,
      ),
    );
  }
  return { policyId, deleted: matches.length, attestations, dryRun: false as const };
}
