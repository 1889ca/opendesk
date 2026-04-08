/** Contract: contracts/erasure/rules.md */
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { anonymizeDocument } from './anonymizer.ts';

function createDocWithUserContent(clientId: number): Uint8Array {
  const doc = new Y.Doc({ gc: false });
  doc.clientID = clientId;

  const text = doc.getText('default');
  doc.transact(() => {
    text.insert(0, 'Secret user data');
  });

  // Delete some content to create tombstones
  doc.transact(() => {
    text.delete(0, 6); // Delete "Secret"
  });

  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

describe('anonymizer', () => {
  it('returns anonymization result with correct structure', () => {
    const clientId = 12345;
    const state = createDocWithUserContent(clientId);

    const result = anonymizeDocument('doc-1', String(clientId), state);

    expect(result.docId).toBe('doc-1');
    expect(result.targetUserId).toBe(String(clientId));
    expect(result.newState).toBeInstanceOf(Uint8Array);
    expect(result.newState.length).toBeGreaterThan(0);
  });

  it('produces a valid Yjs document after anonymization', () => {
    const clientId = 12345;
    const state = createDocWithUserContent(clientId);

    const result = anonymizeDocument('doc-1', String(clientId), state);

    // Verify the new state can be loaded into a Yjs doc
    const doc = new Y.Doc();
    expect(() => Y.applyUpdate(doc, result.newState)).not.toThrow();
    doc.destroy();
  });

  it('preserves document structure for non-target users', () => {
    const doc = new Y.Doc({ gc: false });
    doc.clientID = 99999;

    const text = doc.getText('default');
    doc.transact(() => {
      text.insert(0, 'Other user data');
    });

    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    // Anonymize for a different user
    const result = anonymizeDocument('doc-1', '12345', state);

    // Content from the other user should still be readable
    const resultDoc = new Y.Doc();
    Y.applyUpdate(resultDoc, result.newState);
    expect(resultDoc.getText('default').toString()).toBe('Other user data');
    resultDoc.destroy();
  });

  it('returns zero items anonymized when no matching tombstones', () => {
    const doc = new Y.Doc({ gc: false });
    doc.clientID = 99999;

    const text = doc.getText('default');
    doc.transact(() => {
      text.insert(0, 'Clean content');
    });

    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    const result = anonymizeDocument('doc-1', '12345', state);
    expect(result.itemsAnonymized).toBe(0);
  });
});
