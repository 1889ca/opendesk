/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import { computeAttestationHash } from './attestation.ts';

const baseFields = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  docId: 'doc-123',
  type: 'redaction' as const,
  actorId: 'user-1',
  legalBasis: 'GDPR Art. 17',
  details: 'Redacted 3 items',
  previousHash: null,
  issuedAt: '2026-04-07T12:00:00.000Z',
};

describe('computeAttestationHash', () => {
  it('produces a 64-char hex hash', () => {
    const hash = computeAttestationHash(baseFields, 'test-secret');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic (same inputs produce same hash)', () => {
    const hash1 = computeAttestationHash(baseFields, 'test-secret');
    const hash2 = computeAttestationHash(baseFields, 'test-secret');
    expect(hash1).toBe(hash2);
  });

  it('changes when any field changes', () => {
    const hash1 = computeAttestationHash(baseFields, 'test-secret');
    const hash2 = computeAttestationHash(
      { ...baseFields, details: 'Different details' },
      'test-secret',
    );
    expect(hash1).not.toBe(hash2);
  });

  it('changes when secret changes', () => {
    const hash1 = computeAttestationHash(baseFields, 'secret-1');
    const hash2 = computeAttestationHash(baseFields, 'secret-2');
    expect(hash1).not.toBe(hash2);
  });

  it('includes previousHash in computation', () => {
    const hash1 = computeAttestationHash(baseFields, 'test-secret');
    const hash2 = computeAttestationHash(
      { ...baseFields, previousHash: 'a'.repeat(64) },
      'test-secret',
    );
    expect(hash1).not.toBe(hash2);
  });
});
