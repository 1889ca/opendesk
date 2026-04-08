/** Contract: contracts/erasure/rules.md */

import * as Y from 'yjs';
import type { Pool } from 'pg';
import type { RedactionResult } from '../contract.ts';
import { createAttestation } from './attestation.ts';

export type RedactionOpts = {
  userId?: string;
  pattern?: string;
  legalBasis: string;
  requestedBy: string;
};

/**
 * Redact content matching a pattern or user ID from a Yjs document.
 * Creates an audit trail entry and generates an erasure attestation.
 */
export async function redactContent(
  pool: Pool,
  hmacSecret: string,
  docId: string,
  crdtState: Uint8Array,
  opts: RedactionOpts,
): Promise<{ redactedCount: number; newState: Uint8Array; attestation: Awaited<ReturnType<typeof createAttestation>> }> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, crdtState);

  let redactedCount = 0;
  const patternRegex = opts.pattern ? new RegExp(opts.pattern, 'gi') : null;
  const targetClientId = opts.userId ? parseInt(opts.userId, 10) : null;

  // Walk all shared types
  for (const [, type] of doc.share.entries()) {
    redactedCount += redactType(doc, type, targetClientId, patternRegex);
  }

  const newState = Y.encodeStateAsUpdate(doc);
  doc.destroy();

  const details = buildRedactionDetails(opts, redactedCount);
  const attestation = await createAttestation(
    pool,
    hmacSecret,
    docId,
    'redaction',
    opts.requestedBy,
    opts.legalBasis,
    details,
  );

  return { redactedCount, newState, attestation };
}

/** Walk a Yjs type and redact matching content. */
function redactType(
  doc: Y.Doc,
  type: Y.AbstractType<unknown>,
  targetClientId: number | null,
  patternRegex: RegExp | null,
): number {
  let count = 0;

  if (type instanceof Y.Text) {
    count += redactText(doc, type, targetClientId, patternRegex);
  } else if (type instanceof Y.Array) {
    count += redactArray(doc, type, targetClientId, patternRegex);
  } else if (type instanceof Y.Map) {
    count += redactMap(doc, type, targetClientId, patternRegex);
  }

  return count;
}

/** Redact matching content in a Y.Text. */
function redactText(
  doc: Y.Doc,
  text: Y.Text,
  targetClientId: number | null,
  patternRegex: RegExp | null,
): number {
  const str = text.toString();
  if (!patternRegex) return 0;

  let count = 0;
  doc.transact(() => {
    // Find matches from end to start to preserve indices
    const matches = [...str.matchAll(patternRegex)].reverse();
    for (const match of matches) {
      if (match.index !== undefined) {
        text.delete(match.index, match[0].length);
        text.insert(match.index, '[REDACTED]');
        count++;
      }
    }
  });

  return count;
}

/** Redact matching content in a Y.Array. */
function redactArray(
  doc: Y.Doc,
  arr: Y.Array<unknown>,
  targetClientId: number | null,
  patternRegex: RegExp | null,
): number {
  let count = 0;

  doc.transact(() => {
    for (let i = 0; i < arr.length; i++) {
      const item = arr.get(i);
      if (typeof item === 'string' && patternRegex?.test(item)) {
        arr.delete(i, 1);
        arr.insert(i, ['[REDACTED]']);
        count++;
      }
    }
  });

  return count;
}

/** Redact matching content in a Y.Map. */
function redactMap(
  doc: Y.Doc,
  map: Y.Map<unknown>,
  targetClientId: number | null,
  patternRegex: RegExp | null,
): number {
  let count = 0;

  doc.transact(() => {
    for (const [key, value] of map.entries()) {
      if (typeof value === 'string' && patternRegex?.test(value)) {
        map.set(key, '[REDACTED]');
        count++;
      }
    }
  });

  return count;
}

function buildRedactionDetails(opts: RedactionOpts, count: number): string {
  const target = opts.userId ? `userId=${opts.userId}` : `pattern=${opts.pattern}`;
  return `Redacted ${count} items matching ${target}`;
}
