/** Contract: contracts/collab/rules.md */
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { createIntentExecutor, type IntentExecutorDeps } from './intent-executor.ts';
import { computeRevisionId } from './document-materializer.ts';
import type { DocumentIntent } from '../../document/contract/index.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDoc(): Y.Doc {
  return new Y.Doc();
}

/** Build a minimal text document intent. */
function makeInsertBlockIntent(overrides: Partial<DocumentIntent> = {}): DocumentIntent {
  return {
    idempotencyKey: crypto.randomUUID(),
    baseRevision: 'a'.repeat(64), // will be overridden in tests that care
    actorId: 'agent-001',
    actorType: 'agent',
    documentId: 'doc-test',
    action: {
      type: 'insert_block',
      afterBlockId: null,
      blockType: 'paragraph',
      content: 'Hello world',
    },
    ...overrides,
  };
}

function makeDeps(ydoc: Y.Doc, flushFn?: () => Promise<void>): IntentExecutorDeps {
  const flush = flushFn ?? vi.fn(async () => {});
  return {
    getDoc: (_docId: string) => ydoc,
    flush: (_docId: string, _doc: Y.Doc) => flush(),
    getCurrentRevisionId: (_docId: string) => computeRevisionId(Y.encodeStateVector(ydoc)),
  };
}

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('IntentExecutor — success', () => {
  it('applies an insert_block intent and returns a revisionId', async () => {
    const doc = makeDoc();
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const sv0 = Y.encodeStateVector(doc);
    const baseRevision = computeRevisionId(sv0);
    const intent = makeInsertBlockIntent({ baseRevision, documentId: 'doc-1' });

    const result = await executor.applyIntent(intent);

    expect('code' in result).toBe(false);
    const success = result as { revisionId: string; appliedOperations: number };
    expect(success.revisionId).toMatch(/^[0-9a-f]{64}$/);
    expect(success.appliedOperations).toBeGreaterThanOrEqual(1);
  });

  it('actually mutates the Yjs document', async () => {
    const doc = makeDoc();
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    await executor.applyIntent(makeInsertBlockIntent({ baseRevision, documentId: 'doc-2' }));

    const fragment = doc.getXmlFragment('default');
    expect(fragment.toArray().length).toBe(1);
  });

  it('calls flush exactly once per intent application', async () => {
    const doc = makeDoc();
    const flushFn = vi.fn(async () => {});
    const deps = makeDeps(doc, flushFn);
    const executor = createIntentExecutor(deps);

    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    await executor.applyIntent(makeInsertBlockIntent({ baseRevision, documentId: 'doc-3' }));

    expect(flushFn).toHaveBeenCalledTimes(1);
  });

  it('returns a different revisionId after each successful intent', async () => {
    const doc = makeDoc();
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const rev0 = computeRevisionId(Y.encodeStateVector(doc));

    const result1 = await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision: rev0, documentId: 'doc-4' }),
    );
    const rev1 = (result1 as { revisionId: string }).revisionId;

    const result2 = await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision: rev1, documentId: 'doc-4' }),
    );
    const rev2 = (result2 as { revisionId: string }).revisionId;

    expect(rev1).not.toBe(rev0);
    expect(rev2).not.toBe(rev1);
  });
});

// ---------------------------------------------------------------------------
// OCC conflict path
// ---------------------------------------------------------------------------

describe('IntentExecutor — OCC conflict', () => {
  it('returns STALE_REVISION when baseRevision does not match current', async () => {
    const doc = makeDoc();
    // Mutate the doc so its revision differs from the stale hash
    doc.getText('x').insert(0, 'something');
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const staleRevision = 'b'.repeat(64);
    const intent = makeInsertBlockIntent({ baseRevision: staleRevision, documentId: 'doc-5' });

    const result = await executor.applyIntent(intent);

    expect('code' in result).toBe(true);
    const conflict = result as { code: string; baseRevision: string; currentRevision: string; currentStateVector: Uint8Array };
    expect(conflict.code).toBe('STALE_REVISION');
    expect(conflict.baseRevision).toBe(staleRevision);
    expect(conflict.currentRevision).toMatch(/^[0-9a-f]{64}$/);
    expect(conflict.currentStateVector).toBeInstanceOf(Uint8Array);
  });

  it('does not call flush on a conflict', async () => {
    const doc = makeDoc();
    doc.getText('x').insert(0, 'something');
    const flushFn = vi.fn(async () => {});
    const deps = makeDeps(doc, flushFn);
    const executor = createIntentExecutor(deps);

    await executor.applyIntent(makeInsertBlockIntent({ baseRevision: 'c'.repeat(64), documentId: 'doc-6' }));
    expect(flushFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Idempotency path
// ---------------------------------------------------------------------------

describe('IntentExecutor — idempotency', () => {
  it('returns DUPLICATE_INTENT on second call with same idempotencyKey', async () => {
    const doc = makeDoc();
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    const idempotencyKey = crypto.randomUUID();

    const first = await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision, idempotencyKey, documentId: 'doc-7' }),
    );
    const firstRevision = (first as { revisionId: string }).revisionId;

    // Second call: baseRevision is now stale, but the idempotency key is cached
    const second = await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision, idempotencyKey, documentId: 'doc-7' }),
    );

    expect('code' in second).toBe(true);
    const dup = second as { code: string; originalRevisionId: string };
    expect(dup.code).toBe('DUPLICATE_INTENT');
    expect(dup.originalRevisionId).toBe(firstRevision);
  });

  it('does not re-apply intent on duplicate submission', async () => {
    const doc = makeDoc();
    const flushFn = vi.fn(async () => {});
    const deps = makeDeps(doc, flushFn);
    const executor = createIntentExecutor(deps);

    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    const idempotencyKey = crypto.randomUUID();

    await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision, idempotencyKey, documentId: 'doc-8' }),
    );
    await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision, idempotencyKey, documentId: 'doc-8' }),
    );

    // flush should only have been called once (for the first, non-duplicate apply)
    expect(flushFn).toHaveBeenCalledTimes(1);

    // The document should have exactly one inserted block, not two
    const fragment = doc.getXmlFragment('default');
    expect(fragment.toArray().length).toBe(1);
  });

  it('applies intent normally when using a different idempotencyKey', async () => {
    const doc = makeDoc();
    const deps = makeDeps(doc);
    const executor = createIntentExecutor(deps);

    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision, idempotencyKey: crypto.randomUUID(), documentId: 'doc-9' }),
    );

    const baseRevision2 = computeRevisionId(Y.encodeStateVector(doc));
    const result = await executor.applyIntent(
      makeInsertBlockIntent({ baseRevision: baseRevision2, idempotencyKey: crypto.randomUUID(), documentId: 'doc-9' }),
    );

    expect('code' in result).toBe(false);
    expect((result as { appliedOperations: number }).appliedOperations).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// document_not_loaded
// ---------------------------------------------------------------------------

describe('IntentExecutor — document not loaded', () => {
  it('throws document_not_loaded when getDoc returns null', async () => {
    const executor = createIntentExecutor({
      getDoc: () => null,
      flush: vi.fn(async () => {}),
      getCurrentRevisionId: () => 'a'.repeat(64),
    });

    const intent = makeInsertBlockIntent({ baseRevision: 'a'.repeat(64), documentId: 'doc-missing' });
    await expect(executor.applyIntent(intent)).rejects.toThrow('document_not_loaded');
  });
});
