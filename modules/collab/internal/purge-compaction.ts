/** Contract: contracts/collab/rules.md */
import { Worker } from 'node:worker_threads';

export interface CompactionResult {
  documentId: string;
  originalBytes: number;
  compactedBytes: number;
}

/**
 * Inline ESM worker code for CRDT compaction (purge-safe).
 *
 * Creates a fresh Yjs document from the full encoded state, which
 * compacts the internal operation history while preserving all rich
 * content: XmlFragment structure, text marks (bold, italic, strike,
 * code, links), embedded objects, block attributes, and comments.
 *
 * IMPORTANT: Uses encodeStateAsUpdate / applyUpdate to preserve the
 * full XmlFragment tree. Never use getText().toString() which strips
 * formatting.
 */
const WORKER_CODE = `
import { workerData, parentPort } from 'node:worker_threads';
import * as Y from 'yjs';

try {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, workerData.state);
  const compacted = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  parentPort.postMessage({ compacted }, [compacted.buffer]);
} catch (err) {
  parentPort.postMessage({
    error: err instanceof Error ? err.message : String(err),
  });
}
`;

/**
 * Run CRDT compaction for a document in a worker thread.
 *
 * Per contract: compaction MUST run in worker_threads, never on
 * the main thread. The logical document state MUST be identical
 * before and after compaction.
 */
export function compactDocument(
  documentId: string,
  state: Uint8Array,
): Promise<CompactionResult & { compactedState: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_CODE, {
      workerData: { state },
      eval: true,
    });

    worker.on('message', (msg) => {
      if (msg.error) {
        reject(new Error(`Compaction worker error: ${msg.error}`));
        return;
      }
      const compactedState = new Uint8Array(msg.compacted);
      resolve({
        documentId,
        originalBytes: state.byteLength,
        compactedBytes: compactedState.byteLength,
        compactedState,
      });
    });

    worker.on('error', (err) => {
      reject(
        new Error(`Compaction worker failed for ${documentId}: ${err.message}`),
      );
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Compaction worker exited with code ${code} for ${documentId}`,
          ),
        );
      }
    });
  });
}

/**
 * Check whether a document's Yjs state exceeds the compaction threshold.
 */
export function needsCompaction(
  state: Uint8Array,
  thresholdBytes: number,
): boolean {
  return state.byteLength >= thresholdBytes;
}
