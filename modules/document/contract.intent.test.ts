/** Contract: contracts/document/rules.md — Intent verification tests */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  DocumentIntentSchema,
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
  IntentActionSchema,
} from './contract/index.ts';

// --- Helpers ---

function makeBlockId() {
  return randomUUID();
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
