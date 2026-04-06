/** Contract: contracts/collab/rules.md */
import { Worker } from 'node:worker_threads';

export interface CompactionResult {
  documentId: string;
  originalSize: number;
  compactedSize: number;
  durationMs: number;
}

export interface StorageAdapter {
  saveYjsState(docId: string, state: Uint8Array): Promise<void>;
  loadYjsState(docId: string): Promise<Uint8Array | null>;
}

/**
 * Inline ESM worker code for CRDT compaction.
 * Uses eval mode to avoid .ts extension loader issues in worker_threads.
 * The logic is minimal: apply update to fresh doc, re-encode.
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
 * Monitors document state size and triggers off-thread compaction
 * when the byte threshold is exceeded.
 */
export class CompactionManager {
  private readonly thresholdBytes: number;
  private readonly storage: StorageAdapter;
  private readonly active = new Set<string>();

  constructor(thresholdBytes: number, storage: StorageAdapter) {
    this.thresholdBytes = thresholdBytes;
    this.storage = storage;
  }

  /**
   * Check whether a document's state exceeds the compaction threshold.
   * If so, spawn a worker to compact it and atomically swap in storage.
   * Returns null if compaction was not needed or already in progress.
   */
  async maybeCompact(
    documentId: string,
    currentState: Uint8Array,
  ): Promise<CompactionResult | null> {
    if (currentState.byteLength < this.thresholdBytes) {
      return null;
    }

    if (this.active.has(documentId)) {
      return null;
    }

    this.active.add(documentId);
    try {
      return await this.runCompaction(documentId, currentState);
    } finally {
      this.active.delete(documentId);
    }
  }

  /** Returns the set of document IDs currently being compacted. */
  get activeCompactions(): ReadonlySet<string> {
    return this.active;
  }

  private runCompaction(
    documentId: string,
    state: Uint8Array,
  ): Promise<CompactionResult> {
    const startMs = Date.now();
    const originalSize = state.byteLength;

    return new Promise<CompactionResult>((resolve, reject) => {
      const worker = new Worker(WORKER_CODE, {
        workerData: { state },
        eval: true,
      });

      worker.on('message', async (msg) => {
        if (msg.error) {
          reject(new Error(`Compaction worker error: ${msg.error}`));
          return;
        }

        const compacted = new Uint8Array(msg.compacted);
        try {
          await this.storage.saveYjsState(documentId, compacted);
          resolve({
            documentId,
            originalSize,
            compactedSize: compacted.byteLength,
            durationMs: Date.now() - startMs,
          });
        } catch (err) {
          reject(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      });

      worker.on('error', (err) => {
        reject(new Error(`Compaction worker crashed: ${err.message}`));
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Compaction worker exited with code ${code}`));
        }
      });
    });
  }
}
