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
  ErasureBridge,
  ChainVerifyResult,
  SelectiveDisclosureProof,
  LegalHold,
  ErasureConflict,
  JurisdictionPolicy,
  LegalBasis,
  Jurisdiction,
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
  appendBridge,
  getBridgesForDocument,
  insertHold,
  releaseHold as releaseHoldStore,
  getActiveHolds as getActiveHoldsStore,
} from './erasure-store.ts';
import { computeBridgeHash, computeProofHash, verifyProofHash } from './bridge-hash.ts';
import * as auditStore from '../../audit/internal/audit-store.ts';
import { verifyChainWithBridges } from './chain-verifier.ts';
import { checkConflicts as checkConflictsImpl } from './conflict-checker.ts';
import { getPolicy as getPolicyImpl } from './jurisdiction-policies.ts';
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
function computeAttestationHash(fields: Omit<ErasureAttestation, 'hash'>, secret: string): string {
  const payload = [
    fields.id, fields.docId, fields.type, fields.actorId,
    fields.legalBasis, fields.details, fields.issuedAt,
    fields.previousHash ?? '',
  ].join('|');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Factory: creates the erasure module. */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool } = deps;
  const hmacSecret = deps.hmacSecret ?? 'default-erasure-secret';

  // --- Basic erasure operations ---

  async function eraseDocument(
    documentId: string, actorId: string,
    _actorType: 'human' | 'agent' | 'system', reason: string,
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
      id: randomUUID(), docId: documentId, type: 'redaction' as const,
      actorId, legalBasis: reason,
      details: `Erased document ${documentId}. Size: ${sizeBefore} -> ${sizeAfter} bytes.`,
      previousHash, issuedAt: new Date().toISOString(),
    };
    const hash = computeAttestationHash(fields, hmacSecret);
    const attestation: ErasureAttestation = { ...fields, hash };
    await insertAttestation(pool, attestation);
    log.info('erasure complete', { documentId, sizeBefore, sizeAfter });
    return attestation;
  }

  async function scanRetention(): Promise<RetentionScanResult[]> {
    const policies = await listPoliciesStore(pool);
    const results: RetentionScanResult[] = [];
    for (const policy of policies) {
      const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
      results.push({ policy, matchedDocuments: matches });
    }
    return results;
  }

  async function executeRetention(actorId: string): Promise<ErasureAttestation[]> {
    const policies = await getAutoPurgePolicies(pool);
    const attestations: ErasureAttestation[] = [];
    for (const policy of policies) {
      const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
      for (const doc of matches) {
        try {
          attestations.push(await eraseDocument(doc.documentId, actorId, 'system',
            `Auto-purge: policy "${policy.name}" (${policy.maxAgeDays} days)`));
        } catch (err) {
          log.error('auto-purge failed', { documentId: doc.documentId, error: String(err) });
        }
      }
    }
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
      wouldDelete: matches.length, dryRun: true as const,
    };
  }

  async function executePrune(policyId: string, actorId: string): Promise<PruneResult> {
    const policies = await listPoliciesStore(pool);
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) throw new Error(`Policy ${policyId} not found`);
    const matches = await findDocumentsExceedingAge(pool, policy.maxAgeDays, policy.target);
    const attestations: ErasureAttestation[] = [];
    for (const doc of matches) {
      attestations.push(await eraseDocument(doc.documentId, actorId, 'system', `Prune: policy "${policy.name}"`));
    }
    return { policyId, deleted: matches.length, attestations, dryRun: false as const };
  }

  // --- Bridge operations ---

  async function createBridgeImpl(params: Parameters<ErasureModule['createBridge']>[0]): Promise<ErasureBridge> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const bridgeHash = computeBridgeHash({
      documentId: params.documentId, attestationId: params.attestationId,
      preErasureHash: params.preErasureHash, postErasureHash: params.postErasureHash,
      legalBasis: params.legalBasis, createdAt,
    }, hmacSecret);
    const bridge: ErasureBridge = {
      id, documentId: params.documentId, attestationId: params.attestationId,
      preErasureHash: params.preErasureHash, postErasureHash: params.postErasureHash,
      legalBasis: params.legalBasis, jurisdiction: params.jurisdiction ?? null,
      actorId: params.actorId, bridgeHash, createdAt,
    };
    await appendBridge(pool, bridge);
    return bridge;
  }

  async function generateProof(documentId: string, entryId: string): Promise<SelectiveDisclosureProof> {
    const chain = await auditStore.getFullChain(pool, documentId);
    const idx = chain.findIndex((e) => e.id === entryId);
    if (idx === -1) throw new Error(`Entry ${entryId} not found in chain for ${documentId}`);
    const entry = chain[idx];
    const bridges = await getBridgesForDocument(pool, documentId);
    const proofHash = computeProofHash({
      documentId, entryId: entry.id, hashAtPoint: entry.hash,
      timestamp: entry.occurredAt, chainPosition: idx, totalChainLength: chain.length,
    }, hmacSecret);
    return {
      documentId, timestamp: entry.occurredAt, hashAtPoint: entry.hash,
      entryId: entry.id, chainPosition: idx, totalChainLength: chain.length,
      erasureBridges: bridges, proofHash,
    };
  }

  return {
    eraseDocument,
    getAttestations: (documentId) => getAttestationsForDocument(pool, documentId),
    createPolicy: async (data) => {
      const policy: RetentionPolicy = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
      await insertPolicy(pool, policy);
      return policy;
    },
    listPolicies: () => listPoliciesStore(pool),
    deletePolicy: (policyId) => deletePolicyStore(pool, policyId),
    scanRetention,
    executeRetention,
    previewPrune,
    executePrune,
    createBridge: createBridgeImpl,
    verifyChain: (documentId) => verifyChainWithBridges(pool, documentId, hmacSecret),
    generateProof,
    verifyProof: (proof) => verifyProofHash(proof, hmacSecret),
    checkConflicts: (documentId) => checkConflictsImpl(pool, documentId),
    createHold: async (params) => {
      const hold: LegalHold = {
        id: randomUUID(), documentId: params.documentId, holdType: params.holdType,
        authority: params.authority, reason: params.reason ?? null, actorId: params.actorId,
        startedAt: new Date().toISOString(), expiresAt: params.expiresAt ?? null,
        releasedAt: null, releasedBy: null,
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
