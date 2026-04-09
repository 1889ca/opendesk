/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import {
  ErasureBridgeSchema,
  ChainVerifyResultSchema,
  SelectiveDisclosureProofSchema,
  LegalHoldSchema,
  ErasureConflictSchema,
  JurisdictionPolicySchema,
} from './contract.ts';

const validBridge = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  documentId: 'doc-123',
  attestationId: 'att-456',
  preErasureHash: 'a'.repeat(64),
  postErasureHash: 'b'.repeat(64),
  legalBasis: 'GDPR_ART_17',
  jurisdiction: 'EU',
  actorId: 'admin-1',
  bridgeHash: 'c'.repeat(64),
  createdAt: '2026-04-08T12:00:00.000Z',
};

describe('ErasureBridgeSchema', () => {
  it('parses a valid bridge', () => {
    expect(ErasureBridgeSchema.safeParse(validBridge).success).toBe(true);
  });

  it('accepts null jurisdiction', () => {
    expect(ErasureBridgeSchema.safeParse({ ...validBridge, jurisdiction: null }).success).toBe(true);
  });

  it('rejects invalid hash format', () => {
    expect(ErasureBridgeSchema.safeParse({ ...validBridge, bridgeHash: 'short' }).success).toBe(false);
  });

  it('rejects invalid legal basis', () => {
    expect(ErasureBridgeSchema.safeParse({ ...validBridge, legalBasis: 'MADE_UP' }).success).toBe(false);
  });

  it('rejects invalid UUID', () => {
    expect(ErasureBridgeSchema.safeParse({ ...validBridge, id: 'not-uuid' }).success).toBe(false);
  });
});

describe('ChainVerifyResultSchema', () => {
  it('parses VALID result', () => {
    const result = ChainVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 10,
      status: 'VALID',
      erasureBridgeCount: 0,
      brokenAtId: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses VALID_WITH_ERASURES result', () => {
    const result = ChainVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 10,
      status: 'VALID_WITH_ERASURES',
      erasureBridgeCount: 2,
      brokenAtId: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses TAMPERED result', () => {
    const result = ChainVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 5,
      status: 'TAMPERED',
      erasureBridgeCount: 0,
      brokenAtId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = ChainVerifyResultSchema.safeParse({
      documentId: 'doc-123',
      totalEntries: 5,
      status: 'UNKNOWN',
      erasureBridgeCount: 0,
      brokenAtId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('LegalHoldSchema', () => {
  const validHold = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    documentId: 'doc-123',
    holdType: 'litigation',
    authority: 'Court of Appeals',
    reason: 'Pending case #12345',
    actorId: 'admin-1',
    startedAt: '2026-04-08T12:00:00.000Z',
    expiresAt: null,
    releasedAt: null,
    releasedBy: null,
  };

  it('parses a valid hold', () => {
    expect(LegalHoldSchema.safeParse(validHold).success).toBe(true);
  });

  it('accepts all hold types', () => {
    for (const holdType of ['litigation', 'regulatory', 'ediscovery']) {
      expect(LegalHoldSchema.safeParse({ ...validHold, holdType }).success).toBe(true);
    }
  });

  it('rejects invalid hold type', () => {
    expect(LegalHoldSchema.safeParse({ ...validHold, holdType: 'custom' }).success).toBe(false);
  });
});

describe('ErasureConflictSchema', () => {
  it('parses a blocking conflict', () => {
    const result = ErasureConflictSchema.safeParse({
      type: 'LEGAL_HOLD',
      holdId: '550e8400-e29b-41d4-a716-446655440000',
      authority: 'Court',
      blocking: true,
      message: 'Blocked by litigation hold',
    });
    expect(result.success).toBe(true);
  });

  it('parses a non-blocking conflict', () => {
    const result = ErasureConflictSchema.safeParse({
      type: 'ACTIVE_EDISCOVERY',
      holdId: '550e8400-e29b-41d4-a716-446655440000',
      authority: 'Legal team',
      blocking: false,
      message: 'Override required',
    });
    expect(result.success).toBe(true);
  });
});

describe('JurisdictionPolicySchema', () => {
  it('parses a valid policy', () => {
    const result = JurisdictionPolicySchema.safeParse({
      jurisdiction: 'EU',
      legalBasis: 'GDPR_ART_17',
      erasureDeadlineDays: 30,
      description: 'Right to erasure',
    });
    expect(result.success).toBe(true);
  });
});

describe('SelectiveDisclosureProofSchema', () => {
  it('parses a valid proof', () => {
    const result = SelectiveDisclosureProofSchema.safeParse({
      documentId: 'doc-123',
      timestamp: '2026-04-08T12:00:00.000Z',
      hashAtPoint: 'a'.repeat(64),
      entryId: '550e8400-e29b-41d4-a716-446655440000',
      chainPosition: 5,
      totalChainLength: 10,
      erasureBridges: [],
      proofHash: 'b'.repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it('parses proof with bridges', () => {
    const result = SelectiveDisclosureProofSchema.safeParse({
      documentId: 'doc-123',
      timestamp: '2026-04-08T12:00:00.000Z',
      hashAtPoint: 'a'.repeat(64),
      entryId: '550e8400-e29b-41d4-a716-446655440000',
      chainPosition: 5,
      totalChainLength: 10,
      erasureBridges: [validBridge],
      proofHash: 'b'.repeat(64),
    });
    expect(result.success).toBe(true);
  });
});
