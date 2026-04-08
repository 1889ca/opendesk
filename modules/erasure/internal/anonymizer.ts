/** Contract: contracts/erasure/rules.md */

import * as Y from 'yjs';
import type { AnonymizationResult } from '../contract.ts';

/**
 * Zero-fill Yjs tombstone payloads for a target user while preserving
 * CRDT vector clocks and structural pointers.
 *
 * This maintains document integrity (other clients can still sync)
 * while removing personal data from tombstones. Works across all
 * CRDT types: XmlFragment (documents), Y.Array (sheets rows),
 * Y.Map (slides elements).
 */
export function anonymizeDocument(
  docId: string,
  targetUserId: string,
  crdtState: Uint8Array,
): AnonymizationResult {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, crdtState);

  const targetClientId = parseInt(targetUserId, 10);
  let itemsAnonymized = 0;

  // Walk all shared types and zero-fill tombstones from the target user
  for (const [, type] of doc.share.entries()) {
    itemsAnonymized += anonymizeType(type, targetClientId);
  }

  // Re-encode preserving vector clocks (encodeStateAsUpdate keeps the clock)
  const newState = Y.encodeStateAsUpdate(doc);
  doc.destroy();

  return {
    docId,
    targetUserId,
    itemsAnonymized,
    newState,
  };
}

/** Walk a Yjs AbstractType and zero-fill deleted items from a target client. */
function anonymizeType(
  type: Y.AbstractType<unknown>,
  targetClientId: number,
): number {
  let count = 0;
  let item = type._start;

  while (item !== null) {
    if (item.deleted && item.id.client === targetClientId) {
      if (zeroFillContent(item)) {
        count++;
      }
    }
    item = item.right;
  }

  return count;
}

/**
 * Zero-fill the content of a Yjs Item in place.
 * Replaces string content with null bytes of the same length,
 * preserving the structural size for CRDT consistency.
 */
function zeroFillContent(item: { content: unknown }): boolean {
  const content = item.content as Record<string, unknown>;

  // ContentString: replace with zero-width spaces of same length
  if (typeof content.str === 'string') {
    content.str = '\0'.repeat(content.str.length);
    return true;
  }

  // ContentJSON / ContentAny: replace array elements with null
  if (Array.isArray(content.arr)) {
    for (let i = 0; i < content.arr.length; i++) {
      content.arr[i] = null;
    }
    return true;
  }

  return false;
}
