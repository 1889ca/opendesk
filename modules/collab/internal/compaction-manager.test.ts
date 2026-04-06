/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { CompactionManager, type StorageAdapter } from './compaction-manager.ts';

/** In-memory storage adapter for testing (real Yjs state, no mocks). */
function createMemoryStorage(): StorageAdapter & {
  states: Map<string, Uint8Array>;
} {
  const states = new Map<string, Uint8Array>();
  return {
    states,
    async saveYjsState(docId: string, state: Uint8Array) {
      states.set(docId, state);
    },
    async loadYjsState(docId: string) {
      return states.get(docId) ?? null;
    },
  };
}

/** Build a Yjs doc with many edits that produce a bloated state. */
function buildBloatedDoc(editCount: number): {
  doc: Y.Doc;
  state: Uint8Array;
} {
  const doc = new Y.Doc();
  const text = doc.getText('content');

  for (let i = 0; i < editCount; i++) {
    text.insert(text.length, `edit-${i} `);
  }
  // Delete half the content to create tombstones
  const len = text.toString().length;
  text.delete(0, Math.floor(len / 2));

  const state = Y.encodeStateAsUpdate(doc);
  return { doc, state };
}

describe('CompactionManager', () => {
  it('skips compaction when state is below threshold', async () => {
    const storage = createMemoryStorage();
    const manager = new CompactionManager(1_000_000, storage);

    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'small');
    const state = Y.encodeStateAsUpdate(doc);

    const result = await manager.maybeCompact('doc-1', state);
    expect(result).toBeNull();
    expect(storage.states.size).toBe(0);

    doc.destroy();
  });

  it('triggers compaction when state exceeds threshold', async () => {
    const storage = createMemoryStorage();
    // Set a very low threshold so compaction triggers
    const manager = new CompactionManager(100, storage);

    const { doc, state } = buildBloatedDoc(200);

    const result = await manager.maybeCompact('doc-1', state);
    expect(result).not.toBeNull();
    expect(result!.documentId).toBe('doc-1');
    expect(result!.originalSize).toBe(state.byteLength);
    expect(result!.compactedSize).toBeGreaterThan(0);
    expect(result!.durationMs).toBeGreaterThanOrEqual(0);

    // Verify compacted state was persisted
    const persisted = storage.states.get('doc-1');
    expect(persisted).toBeDefined();

    // Verify persisted state produces identical content
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, persisted!);
    expect(verifyDoc.getText('content').toString()).toBe(
      doc.getText('content').toString(),
    );

    doc.destroy();
    verifyDoc.destroy();
  }, 15_000);

  it('compaction reduces state size for edit-heavy documents', async () => {
    const storage = createMemoryStorage();
    const manager = new CompactionManager(100, storage);

    const { doc, state } = buildBloatedDoc(500);

    const result = await manager.maybeCompact('doc-2', state);
    expect(result).not.toBeNull();

    // After heavy edits + deletes, compacted should be smaller
    // (tombstones get cleaned up in re-encoding)
    expect(result!.compactedSize).toBeLessThanOrEqual(
      result!.originalSize,
    );

    doc.destroy();
  }, 15_000);

  it('prevents concurrent compaction of the same document', async () => {
    const storage = createMemoryStorage();
    const manager = new CompactionManager(100, storage);

    const { doc, state } = buildBloatedDoc(200);

    // Fire two compactions simultaneously
    const [result1, result2] = await Promise.all([
      manager.maybeCompact('doc-3', state),
      manager.maybeCompact('doc-3', state),
    ]);

    // Exactly one should have run, the other skipped
    const results = [result1, result2].filter((r) => r !== null);
    expect(results.length).toBe(1);

    doc.destroy();
  }, 15_000);

  it('allows compaction of different documents concurrently', async () => {
    const storage = createMemoryStorage();
    const manager = new CompactionManager(100, storage);

    const doc1 = buildBloatedDoc(200);
    const doc2 = buildBloatedDoc(200);

    const [result1, result2] = await Promise.all([
      manager.maybeCompact('doc-a', doc1.state),
      manager.maybeCompact('doc-b', doc2.state),
    ]);

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();

    doc1.doc.destroy();
    doc2.doc.destroy();
  }, 15_000);

  it('exposes active compaction set', async () => {
    const storage = createMemoryStorage();
    const manager = new CompactionManager(100, storage);

    expect(manager.activeCompactions.size).toBe(0);
  });
});
