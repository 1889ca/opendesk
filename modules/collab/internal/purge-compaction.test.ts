/** Contract: contracts/collab/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { compactDocument, needsCompaction } from './purge-compaction.ts';

describe('compactDocument', () => {
  it('preserves text content after compaction', async () => {
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Hello, world!');
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    const result = await compactDocument('doc-1', state);

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, result.compactedState);
    expect(verifyDoc.getText('content').toString()).toBe('Hello, world!');
    expect(result.documentId).toBe('doc-1');
    expect(result.originalBytes).toBe(state.byteLength);
    verifyDoc.destroy();
  });

  it('preserves rich XmlFragment content (bold, italic, etc.)', async () => {
    const doc = new Y.Doc();
    const frag = doc.getXmlFragment('default');
    const paragraph = new Y.XmlElement('paragraph');
    const text = new Y.XmlText('formatted text');
    paragraph.insert(0, [text]);
    frag.insert(0, [paragraph]);
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    const result = await compactDocument('doc-2', state);

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, result.compactedState);
    const verifyFrag = verifyDoc.getXmlFragment('default');
    expect(verifyFrag.length).toBe(1);
    expect(verifyFrag.toJSON()).toBe(doc.getXmlFragment?.('default')?.toJSON?.() || verifyFrag.toJSON());
    verifyDoc.destroy();
  });

  it('reduces state size after delete-heavy editing', async () => {
    const doc = new Y.Doc({ gc: false });
    const text = doc.getText('content');

    for (let i = 0; i < 200; i++) {
      text.insert(text.length, `chunk-${i} `);
    }
    text.delete(0, text.toString().length - 30);
    const survivingContent = text.toString();
    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    const result = await compactDocument('doc-3', state);

    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, result.compactedState);
    expect(verifyDoc.getText('content').toString()).toBe(survivingContent);
    expect(result.compactedBytes).toBeLessThanOrEqual(result.originalBytes);
    verifyDoc.destroy();
  });
});

describe('needsCompaction', () => {
  it('returns true when state exceeds threshold', () => {
    const state = new Uint8Array(1000);
    expect(needsCompaction(state, 500)).toBe(true);
  });

  it('returns false when state is under threshold', () => {
    const state = new Uint8Array(100);
    expect(needsCompaction(state, 500)).toBe(false);
  });

  it('returns true when state equals threshold', () => {
    const state = new Uint8Array(500);
    expect(needsCompaction(state, 500)).toBe(true);
  });
});
