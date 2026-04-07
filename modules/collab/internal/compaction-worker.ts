/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';

/**
 * Pure compaction logic for Yjs CRDT state.
 *
 * Creates a fresh Yjs Doc, applies the input state, and re-encodes.
 * This eliminates tombstones and redundant history from the CRDT.
 *
 * The actual worker_threads execution is handled by inline ESM code
 * in compaction-manager.ts to avoid .ts loader issues in workers.
 * This module is exported for direct unit testing.
 */

export interface CompactionInput {
  state: Uint8Array;
}

export function compact(input: CompactionInput): Uint8Array {
  const sourceDoc = new Y.Doc();
  Y.applyUpdate(sourceDoc, input.state);

  // Encode as full state snapshot (eliminates tombstones + history)
  const compacted = Y.encodeStateAsUpdate(sourceDoc);
  sourceDoc.destroy();

  return compacted;
}
