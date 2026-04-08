/** Contract: contracts/erasure/rules.md */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ErasureModule,
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
  insertPolicy,
  listPolicies as listPoliciesStore,
  deletePolicy as deletePolicyStore,
  getAutoPurgePolicies,
  findDocumentsExceedingAge,
} from './erasure-store.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('erasure');

export interface ErasureDependencies {
  pool: Pool;
  hmacSecret?: string;
}

/** SHA-256 hash of a Uint8Array for attestation fingerprints. */
function hashState(state: Uint8Array | null): string {
  if (!state) return 'empty';
  return createHash('sha256').update(state).digest('hex');
}

/** Compute an HMAC-SHA256 hash for attestation chaining. */
function computeHash(fields: Omit<ErasureAttestation, 'hash'>, secret: string): string {
  const payload = [
    fields.id, fields.docId, fields.type, fields.actorId,
    fields.legalBasis, fields.details, fields.issuedAt,
    fields.previousHash ?? '',
  ].join('|');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Factory: creates the erasure module.
 * Every erasure operation produces a cryptographic attestation.
 */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool } = deps;
  const hmacSecret = deps.hmacSecret ?? 'default-erasure-secret';

  async function eraseDocument(
    documentId: string,
    actorId: string,
    _actorType: 'human' | 'agent' | 'system',
    reason: string,
  ): Promise<ErasureAttestation> {
    log.info('starting erasure', { documentId, actorId, reason });

    // Load current state
    const currentState = await loadYjsState(documentId);
    const preHash = hashState(currentState);
    const sizeBefore = currentState?.byteLength ?? 0;

    let sizeAfter: number;

    if (!currentState || currentState.byteLength === 0) {
      sizeAfter = 0;
    } else {
      const result = await compactDocument(documentId, currentState);
      await saveYjsState(documentId, result.compactedState);
      sizeAfter = result.compactedBytes;
    }

    // Get latest attestation for hash chaining
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

    const hash = computeHash(fields, hmacSecret);
    const attestation: ErasureAttestation = { ...fields, hash };

    await insertAttestation(pool, attestation);

    log.info('erasure complete', {
      documentId,
      sizeBefore,
      sizeAfter,
      reduction: sizeBefore > 0 ? `${Math.round((1 - sizeAfter / sizeBefore) * 100)}%` : '0%',
    });

    return attestation;
  }

  async function getAttestations(documentId: string): Promise<ErasureAttestation[]> {
    return getAttestationsForDocument(pool, documentId);
  }

  async function createPolicy(
    data: Omit<RetentionPolicy, 'id' | 'createdAt'>,
  ): Promise<RetentionPolicy> {
    const now = new Date().toISOString();
    const policy: RetentionPolicy = {
      ...data,
      id: randomUUID(),
      createdAt: now,
    };
    await insertPolicy(pool, policy);
    return policy;
  }

  async function listPolicies(): Promise<RetentionPolicy[]> {
    return listPoliciesStore(pool);
  }

  async function deletePolicy(policyId: string): Promise<boolean> {
    return deletePolicyStore(pool, policyId);
  }

  async function scanRetention(): Promise<RetentionScanResult[]> {
    const policies = await listPoliciesStore(pool);
    const results: RetentionScanResult[] = [];

    for (const policy of policies) {
      const matches = await findDocumentsExceedingAge(
        pool,
        policy.maxAgeDays,
        policy.target,
      );
      results.push({ policy, matchedDocuments: matches });
    }

    return results;
  }

  async function executeRetention(actorId: string): Promise<ErasureAttestation[]> {
    const policies = await getAutoPurgePolicies(pool);
    const attestations: ErasureAttestation[] = [];

    for (const policy of policies) {
      const matches = await findDocumentsExceedingAge(
        pool,
        policy.maxAgeDays,
        policy.target,
      );

      for (const doc of matches) {
        try {
          const att = await eraseDocument(
            doc.documentId,
            actorId,
            'system',
            `Auto-purge: policy "${policy.name}" (${policy.maxAgeDays} days)`,
          );
          attestations.push(att);
        } catch (err) {
          log.error('auto-purge failed for document', {
            documentId: doc.documentId,
            policy: policy.name,
            error: String(err),
          });
        }
      }
    }

    log.info('retention execution complete', {
      policies: policies.length,
      documentsErased: attestations.length,
    });

    return attestations;
  }

  async function previewPrune(policyId: string): Promise<PrunePreview> {
    const policies = await listPoliciesStore(pool);
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);

    const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
    return {
      policyId,
      matchedEntries: matches.map((m) => ({ id: m.documentId, type: policy.target, age: m.ageDays })),
      wouldDelete: matches.length,
      dryRun: true as const,
    };
  }

  async function executePrune(policyId: string, actorId: string): Promise<PruneResult> {
    const policies = await listPoliciesStore(pool);
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);

    const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
    const attestations: ErasureAttestation[] = [];

    for (const doc of matches) {
      const att = await eraseDocument(doc.documentId, actorId, 'system', `Prune: policy "${policy.name}"`);
      attestations.push(att);
    }

    return {
      policyId,
      deleted: matches.length,
      attestations,
      dryRun: false as const,
    };
  }

  return {
    eraseDocument,
    getAttestations,
    createPolicy,
    listPolicies,
    deletePolicy,
    scanRetention,
    executeRetention,
    previewPrune,
    executePrune,
  };
}
