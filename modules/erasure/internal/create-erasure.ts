/** Contract: contracts/erasure/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ErasureModule,
  RetentionPolicy,
  LegalHold,
} from '../contract.ts';
import {
  getAttestationsForDocument,
  insertPolicy,
  listPolicies as listPoliciesStore,
  deletePolicy as deletePolicyStore,
  insertHold,
  releaseHold as releaseHoldStore,
  getActiveHolds as getActiveHoldsStore,
} from './erasure-store.ts';
import { verifyProofHash } from './bridge-hash.ts';
import { verifyChainWithBridges } from './chain-verifier.ts';
import { checkConflicts as checkConflictsImpl } from './conflict-checker.ts';
import { getPolicy as getPolicyImpl } from './jurisdiction-policies.ts';
import {
  eraseDocument as eraseDocumentOp,
  scanRetention as scanRetentionOp,
  executeRetention as executeRetentionOp,
  previewPrune as previewPruneOp,
  executePrune as executePruneOp,
} from './erasure-operations.ts';
import {
  createBridge as createBridgeOp,
  generateProof as generateProofOp,
} from './bridge-operations.ts';

export interface ErasureDependencies {
  pool: Pool;
  hmacSecret?: string;
}

/**
 * Factory: creates the erasure module.
 *
 * Heavy lifting (document erasure, retention, bridges, proofs) lives
 * in erasure-operations.ts and bridge-operations.ts; this factory is
 * a thin wiring layer that injects (pool, hmacSecret) and exposes
 * the public surface declared in the ErasureModule contract.
 */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool } = deps;
  const hmacSecret = deps.hmacSecret ?? 'default-erasure-secret';

  return {
    eraseDocument: (documentId, actorId, actorType, reason) =>
      eraseDocumentOp(pool, hmacSecret, documentId, actorId, actorType, reason),
    getAttestations: (documentId) => getAttestationsForDocument(pool, documentId),
    createPolicy: async (data) => {
      const policy: RetentionPolicy = {
        ...data,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await insertPolicy(pool, policy);
      return policy;
    },
    listPolicies: () => listPoliciesStore(pool),
    deletePolicy: (policyId) => deletePolicyStore(pool, policyId),
    scanRetention: () => scanRetentionOp(pool),
    executeRetention: (actorId) => executeRetentionOp(pool, hmacSecret, actorId),
    previewPrune: (policyId) => previewPruneOp(pool, policyId),
    executePrune: (policyId, actorId) => executePruneOp(pool, hmacSecret, policyId, actorId),
    createBridge: (params) => createBridgeOp(pool, hmacSecret, params),
    verifyChain: (documentId) => verifyChainWithBridges(pool, documentId, hmacSecret),
    generateProof: (documentId, entryId) => generateProofOp(pool, hmacSecret, documentId, entryId),
    verifyProof: (proof) => verifyProofHash(proof, hmacSecret),
    checkConflicts: (documentId) => checkConflictsImpl(pool, documentId),
    createHold: async (params) => {
      const hold: LegalHold = {
        id: randomUUID(),
        documentId: params.documentId,
        holdType: params.holdType,
        authority: params.authority,
        reason: params.reason ?? null,
        actorId: params.actorId,
        startedAt: new Date().toISOString(),
        expiresAt: params.expiresAt ?? null,
        releasedAt: null,
        releasedBy: null,
      };
      await insertHold(pool, hold);
      return hold;
    },
    releaseHold: async (holdId, releasedBy) => {
      const hold = await releaseHoldStore(pool, holdId, releasedBy, new Date().toISOString());
      if (!hold) throw new Error(`Hold ${holdId} not found or already released`);
      return hold;
    },
    getActiveHolds: (documentId) => getActiveHoldsStore(pool, documentId),
    getPolicy: (jurisdiction, legalBasis) => getPolicyImpl(jurisdiction, legalBasis),
  };
}
