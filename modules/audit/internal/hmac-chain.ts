/** Contract: contracts/audit/rules.md */

import { createHmac } from 'node:crypto';
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
  return expected === entry.hash;
}
