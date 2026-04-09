/** Contract: contracts/audit/rules.md */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuditEntry } from '../contract.ts';

export type HashFields = {
  eventId: string;
  documentId: string;
  actorId: string;
  action: string;
  occurredAt: string;
  previousHash: string | null;
};

/**
 * Compute HMAC-SHA256 of canonical pipe-delimited fields.
 * Uses empty string for null previousHash.
 */
export function computeHash(fields: HashFields, secret: string): string {
  const data = [
    fields.eventId,
    fields.documentId,
    fields.actorId,
    fields.action,
    fields.occurredAt,
    fields.previousHash ?? '',
  ].join('|');

  return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify that an audit entry's hash matches recomputation.
 *
 * Uses constant-time comparison so a timing side-channel can't leak
 * information about the correct hash byte-by-byte (review-2026-04-08
 * MED-1). String === in JavaScript may short-circuit on the first
 * differing character.
 */
export function verifyHash(entry: AuditEntry, secret: string): boolean {
  const expected = computeHash(
    {
      eventId: entry.eventId,
      documentId: entry.documentId,
      actorId: entry.actorId,
      action: entry.action,
      occurredAt: entry.occurredAt,
      previousHash: entry.previousHash,
    },
    secret,
  );

  // Reject mismatched lengths fast — timingSafeEqual throws on
  // mismatched-length buffers, and a length mismatch can't be a
  // legitimate equal hash anyway.
  if (expected.length !== entry.hash.length) return false;

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(entry.hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
