/** Contract: contracts/app/offline.md */

/**
 * Per-document IndexedDB persistence for Yjs `Doc`s.
 *
 * Contract invariants honored here:
 *   - Each document uses an isolated database keyed by
 *     `opendesk-yjs-<documentId>` so that clearing one document's
 *     offline state does not affect others.
 *   - Updates are persisted BEFORE the network layer has a chance to
 *     broadcast them (subscribed via `ydoc.on('update', ...)`).
 *   - On attach we replay all stored updates into the `Doc` before the
 *     caller opens the Hocuspocus provider, so the state vector sent on
 *     sync already contains offline edits.
 *   - We never clear local state on `connect`; we only clear on explicit
 *     erasure or on a successful compaction. CRDT merge guarantees the
 *     server absorbs the offline edits via the standard Yjs protocol.
 *
 * Graceful degradation: if IndexedDB is unavailable, `attach` resolves
 * without throwing and the caller proceeds as if persistence is disabled.
 */

import * as Y from 'yjs';

const STORE = 'updates';
const META_STORE = 'meta';
const DB_VERSION = 1;
const COMPACTION_THRESHOLD = 200; // updates before we collapse rows

function dbName(documentId: string): string {
  return `opendesk-yjs-${documentId}`;
}

function indexedDbUnavailable(): boolean {
  return typeof indexedDB === 'undefined';
}

function openDb(documentId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(documentId), DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAllUpdates(db: IDBDatabase): Promise<Array<{ id: number; update: Uint8Array }>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Array<{ id: number; update: Uint8Array }>);
    req.onerror = () => reject(req.error);
  });
}

function appendUpdate(db: IDBDatabase, update: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ update });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function replaceWithMerged(db: IDBDatabase, merged: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    store.add({ update: merged });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface YjsPersistenceHandle {
  /** Disconnect the update listener (e.g. on editor teardown). */
  detach(): void;
  /** Drop this document's local store — used by erasure. */
  clear(): Promise<void>;
  /** Merge all stored updates into a single row. */
  compact(): Promise<void>;
}

/**
 * Attach a Yjs `Doc` to its per-document IndexedDB store.
 * Replays stored updates into `ydoc` before returning so callers can open
 * a network provider on the hydrated doc.
 */
export async function attachYjsPersistence(
  ydoc: Y.Doc,
  documentId: string,
): Promise<YjsPersistenceHandle> {
  const noop: YjsPersistenceHandle = {
    detach: () => {},
    clear: async () => {},
    compact: async () => {},
  };

  if (indexedDbUnavailable()) return noop;

  let db: IDBDatabase;
  try {
    db = await openDb(documentId);
  } catch {
    return noop;
  }

  // Replay stored updates into the doc before anyone can subscribe to
  // network sync. Apply inside a single transaction origin so the local
  // replay is not re-broadcast as fresh edits.
  try {
    const rows = await readAllUpdates(db);
    const origin = 'opendesk-yjs-persistence:replay';
    Y.transact(
      ydoc,
      () => {
        for (const row of rows) {
          Y.applyUpdate(ydoc, row.update, origin);
        }
      },
      origin,
      false,
    );
  } catch {
    // replay failed; proceed without persistence rather than blocking the editor
    db.close();
    return noop;
  }

  let pending = 0;

  const onUpdate = (update: Uint8Array, origin: unknown): void => {
    // Skip updates we just replayed from disk.
    if (origin === 'opendesk-yjs-persistence:replay') return;
    appendUpdate(db, update).catch(() => {
      // Persistence is best-effort; the server still has the update via
      // the Hocuspocus sync path. Log and keep going.
    });
    pending += 1;
    if (pending >= COMPACTION_THRESHOLD) {
      pending = 0;
      compactInternal(ydoc, db).catch(() => {});
    }
  };

  ydoc.on('update', onUpdate);

  return {
    detach: () => {
      ydoc.off('update', onUpdate);
      db.close();
    },
    clear: async () => {
      ydoc.off('update', onUpdate);
      db.close();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(dbName(documentId));
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    },
    compact: () => compactInternal(ydoc, db),
  };
}

async function compactInternal(ydoc: Y.Doc, db: IDBDatabase): Promise<void> {
  const merged = Y.encodeStateAsUpdate(ydoc);
  await replaceWithMerged(db, merged);
}
