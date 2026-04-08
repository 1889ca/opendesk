/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import {
  TombstoneEntrySchema,
  TombstoneReportSchema,
  ErasureAttestationSchema,
  RedactionResultSchema,
  CascadeResultSchema,
} from './contract.ts';

const validAttestation = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  docId: 'doc-123',
  type: 'redaction',
  actorId: 'user-1',
  legalBasis: 'GDPR Art. 17',
  details: 'Redacted 3 items matching userId=user-2',
  hash: 'a'.repeat(64),
  previousHash: null,
  issuedAt: '2026-04-07T12:00:00.000Z',
};

describe('TombstoneEntrySchema', () => {
  it('parses a valid tombstone entry', () => {
    const result = TombstoneEntrySchema.safeParse({
      itemId: '1234:5',
      content: 'deleted text',
      deletedAt: null,
      deletedBy: '1234',
      crdtType: 'text',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid crdtType', () => {
    const result = TombstoneEntrySchema.safeParse({
      itemId: '1234:5',
      content: 'text',
      deletedAt: null,
      deletedBy: null,
      crdtType: 'unknown',
    });
    expect(result.success).toBe(false);
  });
});

describe('TombstoneReportSchema', () => {
  it('parses a valid report', () => {
    const result = TombstoneReportSchema.safeParse({
      docId: 'doc-123',
      tombstones: [],
      extractedAt: '2026-04-07T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid extractedAt', () => {
    const result = TombstoneReportSchema.safeParse({
      docId: 'doc-123',
      tombstones: [],
      extractedAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('ErasureAttestationSchema', () => {
  it('parses a valid attestation', () => {
    const result = ErasureAttestationSchema.safeParse(validAttestation);
    expect(result.success).toBe(true);
  });

  it('accepts chained attestation', () => {
    const result = ErasureAttestationSchema.safeParse({
      ...validAttestation,
      previousHash: 'b'.repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID', () => {
    const result = ErasureAttestationSchema.safeParse({
      ...validAttestation,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hash', () => {
    const result = ErasureAttestationSchema.safeParse({
      ...validAttestation,
      hash: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty legalBasis', () => {
    const result = ErasureAttestationSchema.safeParse({
      ...validAttestation,
      legalBasis: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid erasure type', () => {
    const result = ErasureAttestationSchema.safeParse({
      ...validAttestation,
      type: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });
});

describe('RedactionResultSchema', () => {
  it('parses a valid result', () => {
    const result = RedactionResultSchema.safeParse({
      docId: 'doc-123',
      redactedCount: 3,
      attestation: validAttestation,
    });
    expect(result.success).toBe(true);
  });
});

describe('CascadeResultSchema', () => {
  it('parses a valid cascade result', () => {
    const result = CascadeResultSchema.safeParse({
      sourceEntryId: 'kb-1',
      affectedDocuments: ['doc-1', 'doc-2'],
      notificationsSent: 2,
      attestation: validAttestation,
    });
    expect(result.success).toBe(true);
  });
});

