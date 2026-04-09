/** Contract: contracts/audit/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeHash, verifyHash, type HashFields } from './hmac-chain.ts';
import type { AuditEntry } from '../contract.ts';

const hashFieldsArb = fc.record({
  eventId: fc.uuid(),
  documentId: fc.uuid(),
  actorId: fc.uuid(),
  action: fc.stringMatching(/^[a-zA-Z]{1,30}$/),
  occurredAt: fc.integer({ min: 946684800000, max: 4102444800000 }).map((ms: number) => new Date(ms).toISOString()),
  previousHash: fc.option(fc.stringMatching(/^[0-9a-f]{64}$/), {
    nil: null,
  }),
});

const secretArb = fc.string({ minLength: 1, maxLength: 64 });

describe('audit/hmac-chain property tests', () => {
  it('is deterministic: same inputs always produce the same hash', () => {
    fc.assert(
      fc.property(hashFieldsArb, secretArb, (fields: HashFields, secret: string) => {
        const hash1 = computeHash(fields, secret);
        const hash2 = computeHash(fields, secret);
        expect(hash1).toBe(hash2);
      }),
    );
  });

  it('produces a 64-character hex string', () => {
    fc.assert(
      fc.property(hashFieldsArb, secretArb, (fields: HashFields, secret: string) => {
        const hash = computeHash(fields, secret);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }),
    );
  });

  it('different inputs produce different hashes', () => {
    fc.assert(
      fc.property(
        hashFieldsArb,
        hashFieldsArb,
        secretArb,
        (fields1: HashFields, fields2: HashFields, secret: string) => {
          // Only test when fields are actually different
          const data1 = JSON.stringify(fields1);
          const data2 = JSON.stringify(fields2);
          if (data1 === data2) return;

          const hash1 = computeHash(fields1, secret);
          const hash2 = computeHash(fields2, secret);
          expect(hash1).not.toBe(hash2);
        },
      ),
    );
  });

  it('verifyHash returns true for correctly computed entries', () => {
    fc.assert(
      fc.property(hashFieldsArb, secretArb, (fields: HashFields, secret: string) => {
        const hash = computeHash(fields, secret);
        const entry: AuditEntry = {
          id: fields.eventId,
          eventId: fields.eventId,
          documentId: fields.documentId,
          actorId: fields.actorId,
          actorType: 'human',
          action: fields.action,
          hash,
          previousHash: fields.previousHash,
          occurredAt: fields.occurredAt,
        };
        expect(verifyHash(entry, secret)).toBe(true);
      }),
    );
  });

  it('verifyHash returns false when hash is tampered', () => {
    fc.assert(
      fc.property(hashFieldsArb, secretArb, (fields: HashFields, secret: string) => {
        const hash = computeHash(fields, secret);
        // Flip a hex character to create a tampered hash
        const tampered =
          hash[0] === 'a'
            ? 'b' + hash.slice(1)
            : 'a' + hash.slice(1);
        const entry: AuditEntry = {
          id: fields.eventId,
          eventId: fields.eventId,
          documentId: fields.documentId,
          actorId: fields.actorId,
          actorType: 'human',
          action: fields.action,
          hash: tampered,
          previousHash: fields.previousHash,
          occurredAt: fields.occurredAt,
        };
        expect(verifyHash(entry, secret)).toBe(false);
      }),
    );
  });
});
