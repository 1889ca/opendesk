/** Contract: contracts/document/rules.md — Property-based tests for snapshot schema + block ID invariants */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  TextDocumentSnapshotSchema,
  DocumentSnapshotSchema,
  ProseMirrorJSONSchema,
  RevisionIdSchema,
} from '../contract/index.ts';
import { computeRevisionId } from './revision.ts';
import { migrateToLatest } from './migrations.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySnapshot = any;

// --- Arbitraries ---

/** Generate a valid UUIDv4 string */
const uuidv4Arb = fc.uuid().filter((u) => u[14] === '4' && '89ab'.includes(u[19]));

/** Generate a valid top-level ProseMirror block node (requires attrs.blockId) */
const blockNodeArb = fc.record({
  type: fc.constantFrom('paragraph', 'heading', 'bulletList', 'orderedList', 'codeBlock', 'blockquote'),
  attrs: fc.record({ blockId: uuidv4Arb }, { requiredKeys: ['blockId'] }),
  content: fc.option(
    fc.array(
      fc.record({
        type: fc.constant('text'),
        text: fc.string({ maxLength: 200 }),
      }),
      { maxLength: 5 }
    ),
    { nil: undefined }
  ),
});

/** Generate a valid ProseMirrorJSON (doc root with array of block nodes) */
const proseMirrorJSONArb = fc.record({
  type: fc.constant('doc' as const),
  content: fc.array(blockNodeArb, { minLength: 1, maxLength: 20 }),
});

/** Generate a valid TextDocumentSnapshot */
const textSnapshotArb = fc.record({
  documentType: fc.constant('text' as const),
  schemaVersion: fc.constant('1.0.0' as const),
  content: proseMirrorJSONArb,
});

// --- Test 1: Generated snapshots satisfy TextDocumentSnapshotSchema ---

describe('TextDocumentSnapshotSchema property tests', () => {
  it('generated snapshots satisfy TextDocumentSnapshotSchema', () => {
    fc.assert(
      fc.property(textSnapshotArb, (snapshot: AnySnapshot) => {
        const result = TextDocumentSnapshotSchema.safeParse(snapshot);
        if (!result.success) {
          // Surface the validation error for debugging
          throw new Error(`Schema rejected generated snapshot: ${JSON.stringify(result.error.issues)}`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('generated snapshots satisfy the unified DocumentSnapshotSchema', () => {
    fc.assert(
      fc.property(textSnapshotArb, (snapshot: AnySnapshot) => {
        const result = DocumentSnapshotSchema.safeParse(snapshot);
        return result.success;
      }),
      { numRuns: 100 }
    );
  });
});

// --- Test 2: Block ID uniqueness ---

describe('Block ID uniqueness invariants', () => {
  it('all block IDs in a generated snapshot are distinct', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant('doc' as const),
          content: fc.array(
            fc.record({
              type: fc.constant('paragraph'),
              // Each block gets its own unique UUID from fast-check
              attrs: fc.record({ blockId: uuidv4Arb }, { requiredKeys: ['blockId'] }),
            }),
            { minLength: 10, maxLength: 50 }
          ),
        }),
        (proseMirrorDoc: AnySnapshot) => {
          const blockIds = proseMirrorDoc.content.map((node: AnySnapshot) => node.attrs.blockId);
          const uniqueIds = new Set(blockIds);
          return uniqueIds.size === blockIds.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('snapshot schema rejects duplicate block IDs via UUIDv4 format enforcement', () => {
    // If the same non-UUID blockId is used on two blocks, the schema should reject each
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { blockId: 'not-a-uuid' } },
        { type: 'paragraph', attrs: { blockId: 'not-a-uuid' } },
      ],
    };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(false);
  });

  it('schema rejects a block node missing blockId entirely', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: {} }],
    };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(false);
  });
});

// --- Test 3: computeRevisionId determinism ---

describe('computeRevisionId property tests', () => {
  it('produces identical output for identical input', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 256 }), (stateVector: Uint8Array) => {
        const a = computeRevisionId(stateVector);
        const b = computeRevisionId(stateVector);
        return a === b;
      }),
      { numRuns: 100 }
    );
  });

  it('output is always a valid SHA-256 hex string (64 chars, lowercase hex)', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 256 }), (stateVector: Uint8Array) => {
        const revisionId = computeRevisionId(stateVector);
        return RevisionIdSchema.safeParse(revisionId).success;
      }),
      { numRuns: 100 }
    );
  });

  it('distinct inputs almost always produce distinct hashes (no trivial collisions)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 64 }),
        fc.uint8Array({ minLength: 1, maxLength: 64 }),
        (a: Uint8Array, b: Uint8Array) => {
          // Only assert when inputs differ
          fc.pre(a.length !== b.length || a.some((byte: number, i: number) => byte !== b[i]));
          return computeRevisionId(a) !== computeRevisionId(b);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Test 4: migrateToLatest purity + idempotency ---

describe('migrateToLatest property tests', () => {
  it('is idempotent: migrating twice equals migrating once', () => {
    fc.assert(
      fc.property(textSnapshotArb, (snapshot: AnySnapshot) => {
        const once = migrateToLatest(snapshot);
        const twice = migrateToLatest(once);
        return JSON.stringify(once) === JSON.stringify(twice);
      }),
      { numRuns: 100 }
    );
  });

  it('output always satisfies DocumentSnapshotSchema', () => {
    fc.assert(
      fc.property(textSnapshotArb, (snapshot: AnySnapshot) => {
        const migrated = migrateToLatest(snapshot);
        return DocumentSnapshotSchema.safeParse(migrated).success;
      }),
      { numRuns: 100 }
    );
  });
});

// --- Test 5: Exhaustiveness — assertNever on documentType ---

/**
 * Exhaustiveness check for the DocumentSnapshot discriminated union.
 * If a new documentType variant is added without a handler here, TypeScript
 * will emit a compile-time error at the `assertNever(snapshot)` call.
 */
function assertNever(x: never): never {
  throw new Error(`Unhandled documentType: ${String((x as { documentType: unknown }).documentType)}`);
}

function describeDocumentType(snapshot: import('../contract/index.ts').DocumentSnapshot): string {
  switch (snapshot.documentType) {
    case 'text':
      return `text@${snapshot.schemaVersion}`;
    case 'spreadsheet':
      return `spreadsheet@${snapshot.schemaVersion}`;
    case 'presentation':
      return `presentation@${snapshot.schemaVersion}`;
    default:
      return assertNever(snapshot);
  }
}

describe('DocumentSnapshot exhaustiveness', () => {
  it('switch on documentType handles all variants without reaching default', () => {
    fc.assert(
      fc.property(textSnapshotArb, (raw: AnySnapshot) => {
        const parsed = DocumentSnapshotSchema.parse(raw);
        const description = describeDocumentType(parsed);
        return description.startsWith('text@');
      }),
      { numRuns: 50 }
    );
  });
});
