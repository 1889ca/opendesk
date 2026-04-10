/** Contract: contracts/collab/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createIntentExecutor, type IntentExecutorDeps } from './intent-executor.ts';
import { computeRevisionId } from './document-materializer.ts';

function makeDoc(): Y.Doc {
  return new Y.Doc();
}

function makeDeps(ydoc: Y.Doc): IntentExecutorDeps {
  return {
    getDoc: (_docId: string) => ydoc,
    flush: async () => {},
    getCurrentRevisionId: (_docId: string) => computeRevisionId(Y.encodeStateVector(ydoc)),
  };
}

// ---------------------------------------------------------------------------
// Text intent operations
// ---------------------------------------------------------------------------

describe('IntentExecutor — text operations', () => {
  let doc: Y.Doc;
  let executor: ReturnType<typeof createIntentExecutor>;

  beforeEach(() => {
    doc = makeDoc();
    executor = createIntentExecutor(makeDeps(doc));
  });

  it('insert_block inserts at beginning when afterBlockId is null', async () => {
    const baseRevision = computeRevisionId(Y.encodeStateVector(doc));
    await executor.applyIntent({
      idempotencyKey: crypto.randomUUID(),
      baseRevision,
      actorId: 'agent-001',
      actorType: 'agent',
      documentId: 'doc-txt-1',
      action: { type: 'insert_block', afterBlockId: null, blockType: 'paragraph', content: 'Hello world' },
    });
    const children = doc.getXmlFragment('default').toArray();
    expect(children).toHaveLength(1);
    expect((children[0] as Y.XmlElement).nodeName).toBe('paragraph');
  });

  it('delete_block removes the target block', async () => {
    const baseRev0 = computeRevisionId(Y.encodeStateVector(doc));
    const blockId = crypto.randomUUID();
    await executor.applyIntent({
      idempotencyKey: crypto.randomUUID(),
      baseRevision: baseRev0,
      actorId: 'agent',
      actorType: 'agent',
      documentId: 'doc-txt-2',
      action: { type: 'insert_block', afterBlockId: null, blockType: 'paragraph', content: 'to delete', attrs: { blockId } },
    });

    const baseRev1 = computeRevisionId(Y.encodeStateVector(doc));
    await executor.applyIntent({
      idempotencyKey: crypto.randomUUID(),
      baseRevision: baseRev1,
      actorId: 'agent',
      actorType: 'agent',
      documentId: 'doc-txt-2',
      action: { type: 'delete_block', blockId },
    });

    const children = doc.getXmlFragment('default').toArray();
    expect(children).toHaveLength(0);
  });
});
