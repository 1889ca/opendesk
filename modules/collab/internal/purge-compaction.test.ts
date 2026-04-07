/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  extractContent,
  applyContent,
  purgeDocument,
  type DocContentSnapshot,
} from './purge-compaction.ts';
import type { StorageAdapter } from './compaction-manager.ts';

/** In-memory storage adapter for testing. */
function createTestStorage(): StorageAdapter & { states: Map<string, Uint8Array> } {
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

describe('extractContent + applyContent', () => {
  it('round-trips text content through extract/apply', () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Hello, world!');
    doc.getText('title').insert(0, 'My Document');

    const snapshot = extractContent(doc);
    doc.destroy();

    const freshDoc = new Y.Doc();
    applyContent(freshDoc, snapshot);

    expect(freshDoc.getText('content').toString()).toBe('Hello, world!');
    expect(freshDoc.getText('title').toString()).toBe('My Document');
    freshDoc.destroy();
  });

  it('round-trips map content through extract/apply', () => {
    const doc = new Y.Doc();
    const meta = doc.getMap('meta');
    meta.set('author', 'Alice');
    meta.set('version', 3);

    const snapshot = extractContent(doc);
    doc.destroy();

    const freshDoc = new Y.Doc();
    applyContent(freshDoc, snapshot);

    expect(freshDoc.getMap('meta').get('author')).toBe('Alice');
    expect(freshDoc.getMap('meta').get('version')).toBe(3);
    freshDoc.destroy();
  });

  it('round-trips array content through extract/apply', () => {
    const doc = new Y.Doc();
    doc.getArray('tags').push(['draft', 'important']);

    const snapshot = extractContent(doc);
    doc.destroy();

    const freshDoc = new Y.Doc();
    applyContent(freshDoc, snapshot);

    expect(freshDoc.getArray('tags').toArray()).toEqual(['draft', 'important']);
    freshDoc.destroy();
  });

  it('handles empty document', () => {
    const doc = new Y.Doc();
    doc.getText('content'); // register but don't write

    const snapshot = extractContent(doc);
    doc.destroy();

    const freshDoc = new Y.Doc();
    applyContent(freshDoc, snapshot);

    expect(freshDoc.getText('content').toString()).toBe('');
    freshDoc.destroy();
  });
});

describe('purgeDocument', () => {
  it('preserves content but reduces state size after delete-heavy editing', async () => {
    const storage = createTestStorage();

    // Build a document with lots of edits and deletions
    const doc = new Y.Doc();
    const text = doc.getText('content');

    for (let i = 0; i < 200; i++) {
      text.insert(text.length, `chunk-${i} `);
    }
    // Delete most content to create tombstones
    const fullContent = text.toString();
    text.delete(0, fullContent.length - 30);
    const survivingContent = text.toString();

    const originalState = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    storage.states.set('doc-1', originalState);

    const result = await purgeDocument('doc-1', storage);

    // Content is preserved
    const purgedState = storage.states.get('doc-1')!;
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, purgedState);
    expect(verifyDoc.getText('content').toString()).toBe(survivingContent);
    verifyDoc.destroy();

    // Size should be reduced (tombstones removed)
    expect(result.purgedSize).toBeLessThan(result.originalSize);
    expect(result.documentId).toBe('doc-1');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves complex multi-type documents', async () => {
    const storage = createTestStorage();

    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Hello');
    doc.getMap('meta').set('title', 'Test');
    doc.getArray('tags').push(['a', 'b']);

    storage.states.set('doc-2', Y.encodeStateAsUpdate(doc));
    doc.destroy();

    await purgeDocument('doc-2', storage);

    const purgedState = storage.states.get('doc-2')!;
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, purgedState);

    expect(verifyDoc.getText('content').toString()).toBe('Hello');
    expect(verifyDoc.getMap('meta').get('title')).toBe('Test');
    expect(verifyDoc.getArray('tags').toArray()).toEqual(['a', 'b']);
    verifyDoc.destroy();
  });

  it('throws when document does not exist', async () => {
    const storage = createTestStorage();
    await expect(purgeDocument('nonexistent', storage)).rejects.toThrow(
      'Document nonexistent not found in storage',
    );
  });

  it('produces a fresh Yjs doc with no shared history', async () => {
    const storage = createTestStorage();

    // Two clients editing the same doc
    const doc1 = new Y.Doc({ gc: false });
    const doc2 = new Y.Doc({ gc: false });

    doc1.getText('content').insert(0, 'From client 1');
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
    doc2.getText('content').insert(doc2.getText('content').length, ' and client 2');
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));

    // Delete some content to create tombstones
    doc1.getText('content').delete(0, 5);

    const state = Y.encodeStateAsUpdate(doc1);
    const expectedContent = doc1.getText('content').toString();
    doc1.destroy();
    doc2.destroy();

    storage.states.set('doc-3', state);
    await purgeDocument('doc-3', storage);

    const purgedState = storage.states.get('doc-3')!;
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, purgedState);

    expect(verifyDoc.getText('content').toString()).toBe(expectedContent);

    // The purged state should have fewer bytes (single client, no tombstones)
    expect(purgedState.byteLength).toBeLessThan(state.byteLength);
    verifyDoc.destroy();
  });
});
