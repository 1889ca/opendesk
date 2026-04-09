/** Contract: contracts/erasure/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ErasureModule,
  ErasureBridge,
  SelectiveDisclosureProof,
} from '../contract.ts';
import { appendBridge, getBridgesForDocument } from './erasure-store.ts';
import { computeBridgeHash, computeProofHash } from './bridge-hash.ts';
import * as auditStore from '../../audit/internal/audit-store.ts';

// Bridge / proof operations for the erasure module. The "bridge" is
// the audit-chain stitch that ties pre/post-erasure hashes together
// so the chain stays verifiable across legally-mandated erasures.
// Extracted from create-erasure.ts to keep it under the 200-line
// limit (issue #136).

export async function createBridge(
  pool: Pool,
  hmacSecret: string,
  params: Parameters<ErasureModule['createBridge']>[0],
): Promise<ErasureBridge> {
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
  await appendBridge(pool, bridge);
  return bridge;
}

export async function generateProof(
  pool: Pool,
  hmacSecret: string,
  documentId: string,
  entryId: string,
): Promise<SelectiveDisclosureProof> {
  const chain = await auditStore.getFullChain(pool, documentId);
  const idx = chain.findIndex((e) => e.id === entryId);
  if (idx === -1) {
    throw new Error(`Entry ${entryId} not found in chain for ${documentId}`);
  }
  const entry = chain[idx];
  const bridges = await getBridgesForDocument(pool, documentId);
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
}
