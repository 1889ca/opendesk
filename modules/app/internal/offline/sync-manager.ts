/** Contract: contracts/app/offline.md */

/**
 * Mutation queue manager for offline mode.
 * Queues failed mutating requests (POST/PUT/DELETE) in IndexedDB
 * and flushes them when connectivity returns, using Background Sync
 * API when available, or manual flush as fallback.
 */

const DB_NAME = 'opendesk-sync';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

export interface QueuedMutation {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  idempotencyKey: string;
  created_at: number;
}

type QueueChangeCallback = (count: number) => void;

const queueListeners: QueueChangeCallback[] = [];

/** Subscribe to queue size changes. */
export function onQueueChange(cb: QueueChangeCallback): void {
  queueListeners.push(cb);
}

function notifyQueueChange(count: number): void {
  for (const cb of queueListeners) cb(count);
}

// --- IndexedDB helpers ---

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAdd(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.add(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbCount(store: IDBObjectStore): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// --- Queue operations ---

/** Add a failed mutation to the offline queue. */
export async function queueMutation(mutation: Omit<QueuedMutation, 'id' | 'created_at'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await idbAdd(store, { ...mutation, created_at: Date.now() });
  const count = await idbCount(store);
  db.close();
  notifyQueueChange(count);

  // Request background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    try {
      await (reg as unknown as { sync: { register(tag: string): Promise<void> } }).sync.register('opendesk-sync');
    } catch { /* sync registration failed, will flush manually */ }
  }
}

/** Get the current queue size. */
export async function getQueueSize(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const count = await idbCount(tx.objectStore(STORE_NAME));
  db.close();
  return count;
}

/** Manually flush all queued mutations (called on reconnect). */
export async function flushQueue(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const entries = await idbGetAll<QueuedMutation>(tx.objectStore(STORE_NAME));

  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      if (res.ok || res.status < 500) {
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        delTx.objectStore(STORE_NAME).delete(entry.id!);
        await new Promise<void>((resolve) => { delTx.oncomplete = () => resolve(); });
      }
    } catch {
      break; // Still offline
    }
  }

  // Notify with updated count
  const countTx = db.transaction(STORE_NAME, 'readonly');
  const remaining = await idbCount(countTx.objectStore(STORE_NAME));
  db.close();
  notifyQueueChange(remaining);
}
