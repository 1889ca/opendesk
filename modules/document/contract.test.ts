/** Contract: contracts/document/rules.md — Schema verification tests */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  TextSchemaVersion,
  TextSchemaVersionSchema,
  ProseMirrorJSONSchema,
  TextDocumentSnapshotSchema,
  DocumentSnapshotSchema,
  RevisionIdSchema,
} from './contract.ts';
import { computeRevisionId } from './internal/revision.ts';
import { migrateToLatest } from './internal/migrations.ts';

// --- Helpers ---

function makeBlockId() {
  return randomUUID();
}

function makeValidSnapshot() {
  return {
    documentType: 'text' as const,
    schemaVersion: '1.0.0' as const,
    content: {
      type: 'doc' as const,
      content: [
        { type: 'paragraph', attrs: { blockId: makeBlockId() }, content: [{ type: 'text', text: 'Hello' }] },
      ],
    },
  };
}

// --- TextSchemaVersion ---

describe('TextSchemaVersion', () => {
  it('has a current version', () => {
    expect(TextSchemaVersion.current).toBe('1.0.0');
  });

  it('current points to a valid version', () => {
    expect(TextSchemaVersionSchema.safeParse(TextSchemaVersion.current).success).toBe(true);
  });
});

// --- ProseMirrorJSON ---

describe('ProseMirrorJSONSchema', () => {
  it('accepts valid doc with blockIds', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { blockId: makeBlockId() } },
      ],
    };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects doc without blockId on top-level nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
      ],
    };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects doc with invalid blockId format', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { blockId: 'not-a-uuid' } },
      ],
    };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects non-doc root type', () => {
    const doc = { type: 'paragraph', content: [] };
    expect(ProseMirrorJSONSchema.safeParse(doc).success).toBe(false);
  });
});

// --- DocumentSnapshot ---

describe('DocumentSnapshotSchema', () => {
  it('accepts valid text document snapshot', () => {
    const snapshot = makeValidSnapshot();
    expect(DocumentSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('discriminates on documentType', () => {
    const bad = { ...makeValidSnapshot(), documentType: 'spreadsheet' };
    expect(DocumentSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing schemaVersion', () => {
    const { schemaVersion: _, ...rest } = makeValidSnapshot();
    expect(TextDocumentSnapshotSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid schemaVersion', () => {
    const snapshot = { ...makeValidSnapshot(), schemaVersion: '99.0.0' };
    expect(TextDocumentSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
});

// --- RevisionId ---

describe('RevisionIdSchema', () => {
  it('accepts valid SHA-256 hex string', () => {
    expect(RevisionIdSchema.safeParse('a'.repeat(64)).success).toBe(true);
  });

  it('rejects short strings', () => {
    expect(RevisionIdSchema.safeParse('a'.repeat(63)).success).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(RevisionIdSchema.safeParse('g'.repeat(64)).success).toBe(false);
  });
});

// --- computeRevisionId ---

describe('computeRevisionId', () => {
  it('returns a 64-character hex string', () => {
    const result = computeRevisionId(new Uint8Array([1, 2, 3]));
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]);
    const a = computeRevisionId(input);
    const b = computeRevisionId(input);
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = computeRevisionId(new Uint8Array([1]));
    const b = computeRevisionId(new Uint8Array([2]));
    expect(a).not.toBe(b);
  });
});

// --- migrateToLatest ---

describe('migrateToLatest', () => {
  it('returns current-version snapshot unchanged', () => {
    const snapshot = makeValidSnapshot();
    const result = migrateToLatest(snapshot);
    expect(result).toEqual(snapshot);
  });

  it('is idempotent', () => {
    const snapshot = makeValidSnapshot();
    const once = migrateToLatest(snapshot);
    const twice = migrateToLatest(once);
    expect(once).toEqual(twice);
  });
});
