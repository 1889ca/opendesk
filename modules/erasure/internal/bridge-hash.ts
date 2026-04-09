/** Contract: contracts/erasure/rules.md */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ErasureBridge, SelectiveDisclosureProof } from '../contract.ts';

/**
 * Constant-time hex string comparison. Aligned with the audit
 * chain's verifyHash (review-2026-04-08 MED-1) — `===` on hex
 * strings can leak timing information.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export type BridgeHashFields = {
  documentId: string;
  attestationId: string;
  preErasureHash: string;
  postErasureHash: string;
  legalBasis: string;
  createdAt: string;
};

/**
 * Compute HMAC-SHA256 for an erasure bridge record.
 * Uses pipe-delimited canonical format, same as audit chain.
 */
export function computeBridgeHash(fields: BridgeHashFields, secret: string): string {
  const data = [
    fields.documentId,
    fields.attestationId,
    fields.preErasureHash,
    fields.postErasureHash,
    fields.legalBasis,
    fields.createdAt,
  ].join('|');

  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Verify that a bridge's hash matches recomputation. */
export function verifyBridgeHash(bridge: ErasureBridge, secret: string): boolean {
  const expected = computeBridgeHash(
    {
      documentId: bridge.documentId,
      attestationId: bridge.attestationId,
      preErasureHash: bridge.preErasureHash,
      postErasureHash: bridge.postErasureHash,
      legalBasis: bridge.legalBasis,
      createdAt: bridge.createdAt,
    },
    secret,
  );
  return timingSafeHexEqual(expected, bridge.bridgeHash);
}

export type ProofHashFields = {
  documentId: string;
  entryId: string;
  hashAtPoint: string;
  timestamp: string;
  chainPosition: number;
  totalChainLength: number;
};

/** Compute HMAC-SHA256 for a selective disclosure proof. */
export function computeProofHash(fields: ProofHashFields, secret: string): string {
  const data = [
    fields.documentId,
    fields.entryId,
    fields.hashAtPoint,
    fields.timestamp,
    String(fields.chainPosition),
    String(fields.totalChainLength),
  ].join('|');

  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Verify a selective disclosure proof's HMAC. */
export function verifyProofHash(proof: SelectiveDisclosureProof, secret: string): boolean {
  const expected = computeProofHash(
    {
      documentId: proof.documentId,
      entryId: proof.entryId,
      hashAtPoint: proof.hashAtPoint,
      timestamp: proof.timestamp,
      chainPosition: proof.chainPosition,
      totalChainLength: proof.totalChainLength,
    },
    secret,
  );
  return timingSafeHexEqual(expected, proof.proofHash);
}
