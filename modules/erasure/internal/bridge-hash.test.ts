/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import {
  computeBridgeHash,
  verifyBridgeHash,
  computeProofHash,
  verifyProofHash,
} from './bridge-hash.ts';
import type { ErasureBridge, SelectiveDisclosureProof } from '../contract.ts';

const SECRET = 'test-erasure-secret-key-long-enough-for-hmac';

describe('computeBridgeHash', () => {
  const fields = {
    documentId: 'doc-123',
    attestationId: 'att-456',
    preErasureHash: 'a'.repeat(64),
    postErasureHash: 'b'.repeat(64),
    legalBasis: 'GDPR_ART_17',
    createdAt: '2026-04-08T12:00:00.000Z',
  };

  it('returns a 64-character hex string', () => {
    const hash = computeBridgeHash(fields, SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output', () => {
    const h1 = computeBridgeHash(fields, SECRET);
    const h2 = computeBridgeHash(fields, SECRET);
    expect(h1).toBe(h2);
  });

  it('changes when fields change', () => {
    const altered = { ...fields, documentId: 'doc-999' };
    expect(computeBridgeHash(fields, SECRET)).not.toBe(computeBridgeHash(altered, SECRET));
  });

  it('changes when secret changes', () => {
    const h1 = computeBridgeHash(fields, SECRET);
    const h2 = computeBridgeHash(fields, 'different-secret');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyBridgeHash', () => {
  it('returns true for correctly hashed bridge', () => {
    const bridgeHash = computeBridgeHash(
      {
        documentId: 'doc-123',
        attestationId: 'att-456',
        preErasureHash: 'a'.repeat(64),
        postErasureHash: 'b'.repeat(64),
        legalBasis: 'GDPR_ART_17',
        createdAt: '2026-04-08T12:00:00.000Z',
      },
      SECRET,
    );

    const bridge: ErasureBridge = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: 'doc-123',
      attestationId: 'att-456',
      preErasureHash: 'a'.repeat(64),
      postErasureHash: 'b'.repeat(64),
      legalBasis: 'GDPR_ART_17',
      jurisdiction: 'EU',
      actorId: 'admin-1',
      bridgeHash,
      createdAt: '2026-04-08T12:00:00.000Z',
    };

    expect(verifyBridgeHash(bridge, SECRET)).toBe(true);
  });

  it('returns false when a field is tampered', () => {
    const bridgeHash = computeBridgeHash(
      {
        documentId: 'doc-123',
        attestationId: 'att-456',
        preErasureHash: 'a'.repeat(64),
        postErasureHash: 'b'.repeat(64),
        legalBasis: 'GDPR_ART_17',
        createdAt: '2026-04-08T12:00:00.000Z',
      },
      SECRET,
    );

    const bridge: ErasureBridge = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: 'doc-123',
      attestationId: 'att-TAMPERED',
      preErasureHash: 'a'.repeat(64),
      postErasureHash: 'b'.repeat(64),
      legalBasis: 'GDPR_ART_17',
      jurisdiction: 'EU',
      actorId: 'admin-1',
      bridgeHash,
      createdAt: '2026-04-08T12:00:00.000Z',
    };

    expect(verifyBridgeHash(bridge, SECRET)).toBe(false);
  });
});

describe('computeProofHash', () => {
  const fields = {
    documentId: 'doc-123',
    entryId: '550e8400-e29b-41d4-a716-446655440000',
    hashAtPoint: 'a'.repeat(64),
    timestamp: '2026-04-08T12:00:00.000Z',
    chainPosition: 5,
    totalChainLength: 10,
  };

  it('returns a 64-character hex string', () => {
    expect(computeProofHash(fields, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(computeProofHash(fields, SECRET)).toBe(computeProofHash(fields, SECRET));
  });

  it('changes when position changes', () => {
    const altered = { ...fields, chainPosition: 6 };
    expect(computeProofHash(fields, SECRET)).not.toBe(computeProofHash(altered, SECRET));
  });
});

describe('verifyProofHash', () => {
  it('returns true for valid proof', () => {
    const proofHash = computeProofHash(
      {
        documentId: 'doc-123',
        entryId: '550e8400-e29b-41d4-a716-446655440000',
        hashAtPoint: 'a'.repeat(64),
        timestamp: '2026-04-08T12:00:00.000Z',
        chainPosition: 5,
        totalChainLength: 10,
      },
      SECRET,
    );

    const proof: SelectiveDisclosureProof = {
      documentId: 'doc-123',
      timestamp: '2026-04-08T12:00:00.000Z',
      hashAtPoint: 'a'.repeat(64),
      entryId: '550e8400-e29b-41d4-a716-446655440000',
      chainPosition: 5,
      totalChainLength: 10,
      erasureBridges: [],
      proofHash,
    };

    expect(verifyProofHash(proof, SECRET)).toBe(true);
  });

  it('returns false for tampered proof', () => {
    const proof: SelectiveDisclosureProof = {
      documentId: 'doc-123',
      timestamp: '2026-04-08T12:00:00.000Z',
      hashAtPoint: 'a'.repeat(64),
      entryId: '550e8400-e29b-41d4-a716-446655440000',
      chainPosition: 5,
      totalChainLength: 10,
      erasureBridges: [],
      proofHash: 'f'.repeat(64), // wrong hash
    };

    expect(verifyProofHash(proof, SECRET)).toBe(false);
  });
});
