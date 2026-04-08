/** Contract: contracts/erasure/rules.md */
import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ErasureModule,
  ErasureAttestation,
  RetentionPolicy,
  RetentionScanResult,
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
}

/** SHA-256 hash of a Uint8Array for attestation fingerprints. */
function hashState(state: Uint8Array | null): string {
  if (!state) return 'empty';
  return createHash('sha256').update(state).digest('hex');
}

/**
 * Factory: creates the erasure module.
 * Every erasure operation produces a cryptographic attestation.
 */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool } = deps;

  async function eraseDocument(
    documentId: string,
    actorId: string,
    actorType: 'human' | 'agent' | 'system',
    reason: string,
  ): Promise<ErasureAttestation> {
    log.info('starting erasure', { documentId, actorId, reason });

    // Load current state
    const currentState = await loadYjsState(documentId);
    const preHash = hashState(currentState);
    const sizeBefore = currentState?.byteLength ?? 0;

    let postHash: string;
    let sizeAfter: number;
    let stateChanged: boolean;

    if (!currentState || currentState.byteLength === 0) {
      // Nothing to erase
      postHash = preHash;
      sizeAfter = 0;
      stateChanged = false;
    } else {
      // Compact: destroys CRDT history, tombstones, operation log
      const result = await compactDocument(documentId, currentState);
      await saveYjsState(documentId, result.compactedState);

      postHash = hashState(result.compactedState);
      sizeAfter = result.compactedBytes;
      stateChanged = preHash !== postHash;
    }

    const attestation: ErasureAttestation = {
      id: randomUUID(),
      documentId,
      actorId,
      actorType,
      reason,
      preStateHash: preHash,
      postStateHash: postHash,
      stateChanged,
      yjsSizeBefore: sizeBefore,
      yjsSizeAfter: sizeAfter,
      createdAt: new Date().toISOString(),
    };

    await insertAttestation(pool, attestation);

    log.info('erasure complete', {
      documentId,
      stateChanged,
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
    const policy: RetentionPolicy = {
      ...data,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
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
        policy.documentType,
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
        policy.documentType,
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

  return {
    eraseDocument,
    getAttestations,
    createPolicy,
    listPolicies,
    deletePolicy,
    scanRetention,
    executeRetention,
  };
}
