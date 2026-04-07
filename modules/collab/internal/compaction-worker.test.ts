/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { compact } from './compaction-worker.ts';

describe('compaction-worker: compact()', () => {
  it('preserves document content after compaction', () => {
    const doc = new Y.Doc();
    const text = doc.getText('content');

    // Apply many individual updates to build up history
    for (let i = 0; i < 100; i++) {
      text.insert(text.length, `line ${i}\n`);
    }

    const state = Y.encodeStateAsUpdate(doc);
    const compacted = compact({ state });

    // Verify the compacted state produces identical content
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, compacted);
    const verifyText = verifyDoc.getText('content');

    expect(verifyText.toString()).toBe(text.toString());

    doc.destroy();
    verifyDoc.destroy();
  });

  it('preserves complex document structures', () => {
    const doc = new Y.Doc();
    const text = doc.getText('content');
    const map = doc.getMap('meta');
    const array = doc.getArray('items');

    text.insert(0, 'Hello, world!');
    map.set('title', 'Test Document');
    map.set('version', 42);
    array.push(['item1', 'item2', 'item3']);

    const state = Y.encodeStateAsUpdate(doc);
    const compacted = compact({ state });

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, compacted);

    expect(verifyDoc.getText('content').toString()).toBe('Hello, world!');
    expect(verifyDoc.getMap('meta').get('title')).toBe('Test Document');
    expect(verifyDoc.getMap('meta').get('version')).toBe(42);
    expect(verifyDoc.getArray('items').toArray()).toEqual([
      'item1',
      'item2',
      'item3',
    ]);

    doc.destroy();
    verifyDoc.destroy();
  });

  it('handles empty documents', () => {
    const doc = new Y.Doc();
    const state = Y.encodeStateAsUpdate(doc);
    const compacted = compact({ state });

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, compacted);

    expect(verifyDoc.getText('content').toString()).toBe('');
    doc.destroy();
    verifyDoc.destroy();
  });

  it('preserves content after delete-heavy editing', () => {
    const doc = new Y.Doc();
    const text = doc.getText('content');

    // Insert lots of text then delete most of it
    for (let i = 0; i < 200; i++) {
      text.insert(text.length, `chunk-${i} `);
    }
    // Delete most content, leaving only the last chunk
    const finalContent = text.toString();
    const keepLength = 20;
    text.delete(0, finalContent.length - keepLength);

    const remaining = text.toString();
    const state = Y.encodeStateAsUpdate(doc);
    const compacted = compact({ state });

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, compacted);

    expect(verifyDoc.getText('content').toString()).toBe(remaining);

    doc.destroy();
    verifyDoc.destroy();
  });
});
