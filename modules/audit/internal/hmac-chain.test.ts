/** Contract: contracts/audit/rules.md */
import { describe, it, expect } from 'vitest';
import { computeHash, verifyHash } from './hmac-chain.ts';
import type { AuditEntry } from '../contract.ts';

const SECRET = 'test-secret-key-that-is-long-enough-for-hmac';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    eventId: '660e8400-e29b-41d4-a716-446655440001',
    documentId: 'doc-123',
    actorId: 'user-1',
    actorType: 'human',
    action: 'DocumentUpdated',
    hash: '', // will be computed
    previousHash: null,
    occurredAt: '2026-04-07T12:00:00.000Z',
    ...overrides,
  };
}

describe('computeHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeHash(
      {
        eventId: '660e8400-e29b-41d4-a716-446655440001',
        documentId: 'doc-123',
        actorId: 'user-1',
        action: 'DocumentUpdated',
        occurredAt: '2026-04-07T12:00:00.000Z',
        previousHash: null,
      },
      SECRET,
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output', () => {
    const fields = {
      eventId: '660e8400-e29b-41d4-a716-446655440001',
      documentId: 'doc-123',
      actorId: 'user-1',
      action: 'DocumentUpdated',
      occurredAt: '2026-04-07T12:00:00.000Z',
      previousHash: null,
    };
    const h1 = computeHash(fields, SECRET);
    const h2 = computeHash(fields, SECRET);
    expect(h1).toBe(h2);
  });

  it('changes when fields change', () => {
    const base = {
      eventId: '660e8400-e29b-41d4-a716-446655440001',
      documentId: 'doc-123',
      actorId: 'user-1',
      action: 'DocumentUpdated',
      occurredAt: '2026-04-07T12:00:00.000Z',
      previousHash: null,
    };
    const altered = { ...base, actorId: 'user-2' };
    expect(computeHash(base, SECRET)).not.toBe(computeHash(altered, SECRET));
  });

  it('changes when secret changes', () => {
    const fields = {
      eventId: '660e8400-e29b-41d4-a716-446655440001',
      documentId: 'doc-123',
      actorId: 'user-1',
      action: 'DocumentUpdated',
      occurredAt: '2026-04-07T12:00:00.000Z',
      previousHash: null,
    };
    const h1 = computeHash(fields, SECRET);
    const h2 = computeHash(fields, 'different-secret');
    expect(h1).not.toBe(h2);
  });
});

describe('verifyHash', () => {
  it('returns true for correctly hashed entry', () => {
    const entry = makeEntry();
    entry.hash = computeHash(
      {
        eventId: entry.eventId,
        documentId: entry.documentId,
        actorId: entry.actorId,
        action: entry.action,
        occurredAt: entry.occurredAt,
        previousHash: entry.previousHash,
      },
      SECRET,
    );
    expect(verifyHash(entry, SECRET)).toBe(true);
  });

  it('returns false when a field is tampered', () => {
    const entry = makeEntry();
    entry.hash = computeHash(
      {
        eventId: entry.eventId,
        documentId: entry.documentId,
        actorId: entry.actorId,
        action: entry.action,
        occurredAt: entry.occurredAt,
        previousHash: entry.previousHash,
      },
      SECRET,
    );
    // Tamper with actorId
    entry.actorId = 'attacker';
    expect(verifyHash(entry, SECRET)).toBe(false);
  });
});

describe('chain of entries', () => {
  it('each entry links to previous hash', () => {
    const entries: AuditEntry[] = [];

    for (let i = 0; i < 3; i++) {
      const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;
      const eventId = `660e8400-e29b-41d4-a716-44665544000${i}`;
      const hash = computeHash(
        {
          eventId,
          documentId: 'doc-123',
          actorId: 'user-1',
          action: 'DocumentUpdated',
          occurredAt: `2026-04-07T12:0${i}:00.000Z`,
          previousHash,
        },
        SECRET,
      );
      entries.push(
        makeEntry({
          id: `550e8400-e29b-41d4-a716-44665544000${i}`,
          eventId,
          hash,
          previousHash,
          occurredAt: `2026-04-07T12:0${i}:00.000Z`,
        }),
      );
    }

    // Verify chain links
    expect(entries[0].previousHash).toBeNull();
    expect(entries[1].previousHash).toBe(entries[0].hash);
    expect(entries[2].previousHash).toBe(entries[1].hash);

    // All entries verify
    for (const entry of entries) {
      expect(verifyHash(entry, SECRET)).toBe(true);
    }
  });
});
