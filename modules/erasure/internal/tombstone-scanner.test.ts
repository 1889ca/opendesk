/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { extractTombstones } from './tombstone-scanner.ts';

function createDocWithTombstones(): Uint8Array {
  const doc = new Y.Doc({ gc: false });
  const text = doc.getText('default');

  doc.transact(() => {
    text.insert(0, 'Hello World');
  });

  doc.transact(() => {
    text.delete(5, 6); // Delete " World"
  });

  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

function createDocWithArrayTombstones(): Uint8Array {
  const doc = new Y.Doc({ gc: false });
  const arr = doc.getArray('default');

  doc.transact(() => {
    arr.insert(0, ['item1', 'item2', 'item3']);
  });

  doc.transact(() => {
    arr.delete(1, 1); // Delete "item2"
  });

  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

function createCleanDoc(): Uint8Array {
  const doc = new Y.Doc();
  const text = doc.getText('default');
  doc.transact(() => {
    text.insert(0, 'No deletions here');
  });
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

describe('tombstone-scanner', () => {
  it('extracts tombstones from a document with deletions', () => {
    const state = createDocWithTombstones();
    const report = extractTombstones('doc-1', state);

    expect(report.docId).toBe('doc-1');
    expect(report.tombstones.length).toBeGreaterThan(0);
    expect(report.extractedAt).toBeTruthy();

    const contents = report.tombstones.map((t) => t.content);
    expect(contents.some((c) => c.includes('World') || c.includes(' '))).toBe(true);
  });

  it('returns empty tombstones for a clean document', () => {
    const state = createCleanDoc();
    const report = extractTombstones('doc-2', state);

    expect(report.docId).toBe('doc-2');
    expect(report.tombstones.length).toBe(0);
  });

  it('extracts tombstones from arrays', () => {
    const state = createDocWithArrayTombstones();
    const report = extractTombstones('doc-3', state);

    expect(report.tombstones.length).toBeGreaterThan(0);
  });

  it('deduplicates tombstone entries', () => {
    const state = createDocWithTombstones();
    const report = extractTombstones('doc-4', state);

    const ids = report.tombstones.map((t) => t.itemId);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('includes crdtType in tombstone entries', () => {
    const state = createDocWithTombstones();
    const report = extractTombstones('doc-5', state);

    for (const tombstone of report.tombstones) {
      expect(['text', 'array', 'map', 'xml']).toContain(tombstone.crdtType);
    }
  });
});
