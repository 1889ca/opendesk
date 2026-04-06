/** Contract: contracts/document/rules.md — Verification tests */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  TextSchemaVersion,
  TextSchemaVersionSchema,
  ProseMirrorJSONSchema,
  TextDocumentSnapshotSchema,
  DocumentSnapshotSchema,
  RevisionIdSchema,
  DocumentIntentSchema,
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
  IntentActionSchema,
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

function makeValidIntent(overrides = {}) {
  return {
    idempotencyKey: randomUUID(),
    baseRevision: 'a'.repeat(64),
    actorId: 'user-1',
    actorType: 'human' as const,
    documentId: 'doc-1',
    action: {
      type: 'insert_block' as const,
      afterBlockId: null,
      blockType: 'paragraph',
      content: 'Hello world',
    },
    ...overrides,
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

// --- DocumentIntent ---

describe('DocumentIntentSchema', () => {
  it('accepts valid insert_block intent', () => {
    const intent = makeValidIntent();
    expect(DocumentIntentSchema.safeParse(intent).success).toBe(true);
  });

  it('rejects non-UUIDv4 idempotencyKey', () => {
    const intent = makeValidIntent({ idempotencyKey: 'not-a-uuid' });
    expect(DocumentIntentSchema.safeParse(intent).success).toBe(false);
  });

  it('rejects invalid baseRevision', () => {
    const intent = makeValidIntent({ baseRevision: 'short' });
    expect(DocumentIntentSchema.safeParse(intent).success).toBe(false);
  });

  it('rejects unknown actorType', () => {
    const intent = makeValidIntent({ actorType: 'robot' });
    expect(DocumentIntentSchema.safeParse(intent).success).toBe(false);
  });
});

// --- IntentAction variants ---

describe('IntentAction schemas', () => {
  it('insert_block requires afterBlockId (nullable)', () => {
    const valid = { type: 'insert_block', afterBlockId: null, blockType: 'paragraph', content: 'hi' };
    expect(InsertBlockIntentSchema.safeParse(valid).success).toBe(true);

    const withId = { type: 'insert_block', afterBlockId: makeBlockId(), blockType: 'paragraph', content: 'hi' };
    expect(InsertBlockIntentSchema.safeParse(withId).success).toBe(true);
  });

  it('update_block requires valid blockId', () => {
    const valid = { type: 'update_block', blockId: makeBlockId(), content: 'new text' };
    expect(UpdateBlockIntentSchema.safeParse(valid).success).toBe(true);

    const bad = { type: 'update_block', blockId: 'not-uuid', content: 'new text' };
    expect(UpdateBlockIntentSchema.safeParse(bad).success).toBe(false);
  });

  it('delete_block requires valid blockId', () => {
    const valid = { type: 'delete_block', blockId: makeBlockId() };
    expect(DeleteBlockIntentSchema.safeParse(valid).success).toBe(true);
  });

  it('update_marks validates range', () => {
    const valid = {
      type: 'update_marks',
      blockId: makeBlockId(),
      range: { start: 0, end: 5 },
      marks: [{ type: 'bold' }],
      action: 'add',
    };
    expect(UpdateMarksIntentSchema.safeParse(valid).success).toBe(true);
  });

  it('update_marks rejects start >= end', () => {
    const bad = {
      type: 'update_marks',
      blockId: makeBlockId(),
      range: { start: 5, end: 3 },
      marks: [{ type: 'bold' }],
      action: 'add',
    };
    expect(UpdateMarksIntentSchema.safeParse(bad).success).toBe(false);
  });

  it('update_marks rejects empty marks array', () => {
    const bad = {
      type: 'update_marks',
      blockId: makeBlockId(),
      range: { start: 0, end: 5 },
      marks: [],
      action: 'add',
    };
    expect(UpdateMarksIntentSchema.safeParse(bad).success).toBe(false);
  });

  it('discriminated union rejects unknown action type', () => {
    const bad = { type: 'explode', blockId: makeBlockId() };
    expect(IntentActionSchema.safeParse(bad).success).toBe(false);
  });
});

// --- Block-ID-based targeting (Decision #003) ---

describe('Block-ID-based targeting', () => {
  it('no intent schema accepts index, path, or position fields', () => {
    // Verify the schemas don't have positional targeting
    const insertShape = InsertBlockIntentSchema.shape;
    expect('index' in insertShape).toBe(false);
    expect('path' in insertShape).toBe(false);
    expect('position' in insertShape).toBe(false);

    const updateShape = UpdateBlockIntentSchema.shape;
    expect('index' in updateShape).toBe(false);
    expect('path' in updateShape).toBe(false);

    const deleteShape = DeleteBlockIntentSchema.shape;
    expect('index' in deleteShape).toBe(false);
    expect('path' in deleteShape).toBe(false);
  });
});
