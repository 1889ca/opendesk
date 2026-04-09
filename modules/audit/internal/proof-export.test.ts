/** Contract: contracts/audit/rules.md */
import { describe, it, expect } from 'vitest';
import { verifyAuditProof, type AuditProof } from './proof-export.ts';
import { computeHash } from './hmac-chain.ts';

const SECRET = 'test-secret-key-that-is-at-least-32-chars!';

function buildChain(length: number) {
  const entries: Array<{ id: string; eventId: string; documentId: string; actorId: string; actorType: 'human'; action: string; hash: string; previousHash: string | null; occurredAt: string }> = [];
  for (let i = 0; i < length; i++) {
    const eventId = `e${i}000000-0000-4000-a000-000000000000`;
    const id = `a${i}000000-0000-4000-a000-000000000000`;
    const previousHash: string | null = i === 0 ? null : entries[i - 1].hash;
    const occurredAt = `2026-04-07T${String(i).padStart(2, '0')}:00:00.000Z`;

    const hash = computeHash(
      { eventId, documentId: 'doc-1', actorId: 'user-1', action: 'DocumentUpdated', occurredAt, previousHash },
      SECRET,
    );

    entries.push({
      id,
      eventId,
      documentId: 'doc-1',
      actorId: 'user-1',
      actorType: 'human' as const,
      action: 'DocumentUpdated',
      hash,
      previousHash,
      occurredAt,
    });
  }
  return entries;
}

describe('verifyAuditProof', () => {
  it('verifies a valid 5-entry chain', () => {
    const chain = buildChain(5);
    const proof: AuditProof = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documentId: 'doc-1',
      totalEntries: 5,
      anchorHash: chain[0].hash,
      headHash: chain[4].hash,
      chain,
      verifiedAtExport: true,
    };

    const result = verifyAuditProof(proof, SECRET);
    expect(result.verified).toBe(true);
    expect(result.brokenAtIndex).toBeNull();
    expect(result.brokenAtId).toBeNull();
  });

  it('detects a tampered entry', () => {
    const chain = buildChain(3);
    chain[1] = { ...chain[1], actorId: 'tampered-user' };
    const proof: AuditProof = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documentId: 'doc-1',
      totalEntries: 3,
      anchorHash: chain[0].hash,
      headHash: chain[2].hash,
      chain,
      verifiedAtExport: false,
    };

    const result = verifyAuditProof(proof, SECRET);
    expect(result.verified).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.brokenAtId).toBe(chain[1].id);
  });

  it('detects a broken chain link', () => {
    const chain = buildChain(3);
    chain[2] = { ...chain[2], previousHash: 'aaaa'.repeat(16) };
    const proof: AuditProof = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documentId: 'doc-1',
      totalEntries: 3,
      anchorHash: chain[0].hash,
      headHash: chain[2].hash,
      chain,
      verifiedAtExport: false,
    };

    const result = verifyAuditProof(proof, SECRET);
    expect(result.verified).toBe(false);
    expect(result.brokenAtIndex).toBe(2);
  });

  it('rejects verification with wrong secret', () => {
    const chain = buildChain(2);
    const proof: AuditProof = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documentId: 'doc-1',
      totalEntries: 2,
      anchorHash: chain[0].hash,
      headHash: chain[1].hash,
      chain,
      verifiedAtExport: true,
    };

    const result = verifyAuditProof(proof, 'wrong-secret-that-is-also-32-chars!!');
    expect(result.verified).toBe(false);
    expect(result.brokenAtIndex).toBe(0);
  });

  it('verifies an empty chain', () => {
    const proof: AuditProof = {
      version: 1,
      exportedAt: new Date().toISOString(),
      documentId: 'doc-1',
      totalEntries: 0,
      anchorHash: '',
      headHash: '',
      chain: [],
      verifiedAtExport: true,
    };

    const result = verifyAuditProof(proof, SECRET);
    expect(result.verified).toBe(true);
  });
});
