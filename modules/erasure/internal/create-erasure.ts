/** Contract: contracts/erasure/rules.md */

import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  ErasureModule,
  ErasureBridge,
  ChainVerifyResult,
  SelectiveDisclosureProof,
  LegalHold,
  ErasureConflict,
  JurisdictionPolicy,
  LegalBasis,
  HoldType,
  Jurisdiction,
} from '../contract.ts';
import { computeBridgeHash, computeProofHash, verifyProofHash } from './bridge-hash.ts';
import * as store from './erasure-store.ts';
import * as auditStore from '../../audit/internal/audit-store.ts';
import { verifyChainWithBridges } from './chain-verifier.ts';
import { checkConflicts } from './conflict-checker.ts';
import { getPolicy } from './jurisdiction-policies.ts';

export type ErasureDependencies = {
  pool: Pool;
  hmacSecret: string;
};

/** Factory: creates the erasure module. */
export function createErasure(deps: ErasureDependencies): ErasureModule {
  const { pool, hmacSecret } = deps;

  return {
    async createBridge(params): Promise<ErasureBridge> {
      const id = randomUUID();
      const createdAt = new Date().toISOString();

      const bridgeHash = computeBridgeHash(
        {
          documentId: params.documentId,
          attestationId: params.attestationId,
          preErasureHash: params.preErasureHash,
          postErasureHash: params.postErasureHash,
          legalBasis: params.legalBasis,
          createdAt,
        },
        hmacSecret,
      );

      const bridge: ErasureBridge = {
        id,
        documentId: params.documentId,
        attestationId: params.attestationId,
        preErasureHash: params.preErasureHash,
        postErasureHash: params.postErasureHash,
        legalBasis: params.legalBasis,
        jurisdiction: params.jurisdiction ?? null,
        actorId: params.actorId,
        bridgeHash,
        createdAt,
      };

      await store.appendBridge(pool, bridge);
      return bridge;
    },

    async verifyChain(documentId: string): Promise<ChainVerifyResult> {
      return verifyChainWithBridges(pool, documentId, hmacSecret);
    },

    async generateProof(documentId: string, entryId: string): Promise<SelectiveDisclosureProof> {
      const chain = await auditStore.getFullChain(pool, documentId);
      const idx = chain.findIndex((e) => e.id === entryId);
      if (idx === -1) {
        throw new Error(`Entry ${entryId} not found in chain for ${documentId}`);
      }

      const entry = chain[idx];
      const bridges = await store.getBridgesForDocument(pool, documentId);

      const proofHash = computeProofHash(
        {
          documentId,
          entryId: entry.id,
          hashAtPoint: entry.hash,
          timestamp: entry.occurredAt,
          chainPosition: idx,
          totalChainLength: chain.length,
        },
        hmacSecret,
      );

      return {
        documentId,
        timestamp: entry.occurredAt,
        hashAtPoint: entry.hash,
        entryId: entry.id,
        chainPosition: idx,
        totalChainLength: chain.length,
        erasureBridges: bridges,
        proofHash,
      };
    },

    verifyProof(proof: SelectiveDisclosureProof): boolean {
      return verifyProofHash(proof, hmacSecret);
    },

    async checkConflicts(documentId: string): Promise<ErasureConflict[]> {
      return checkConflicts(pool, documentId);
    },

    async createHold(params): Promise<LegalHold> {
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

      await store.insertHold(pool, hold);
      return hold;
    },

    async releaseHold(holdId: string, releasedBy: string): Promise<LegalHold> {
      const releasedAt = new Date().toISOString();
      const hold = await store.releaseHold(pool, holdId, releasedBy, releasedAt);
      if (!hold) {
        throw new Error(`Hold ${holdId} not found or already released`);
      }
      return hold;
    },

    async getActiveHolds(documentId: string): Promise<LegalHold[]> {
      return store.getActiveHolds(pool, documentId);
    },

    getPolicy(jurisdiction: Jurisdiction, legalBasis: LegalBasis): JurisdictionPolicy {
      return getPolicy(jurisdiction, legalBasis);
    },
  };
}
