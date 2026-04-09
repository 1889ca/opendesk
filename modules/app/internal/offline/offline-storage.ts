/** Contract: contracts/app/offline.md */

/**
 * IndexedDB helpers for offline document cache and UI state persistence.
 * Stores: document list cache, sidebar state (recent/starred), notifications.
 */

const DB_NAME = 'opendesk-offline';
const DB_VERSION = 1;

const STORE_DOC_LIST = 'docList';
const STORE_SIDEBAR = 'sidebar';
const STORE_NOTIFICATIONS = 'notifications';

/** Cached document entry for offline dashboard. */
export interface CachedDocEntry {
  id: string;
  title: string;
  updated_at: string;
  cached_at: number;
}

/** Sidebar state entry (recent docs, starred items). */
export interface SidebarEntry {
  key: string;
  value: unknown;
  updated_at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Open (or reuse) the offline database. */
function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOC_LIST)) {
        db.createObjectStore(STORE_DOC_LIST, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SIDEBAR)) {
        db.createObjectStore(STORE_SIDEBAR, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_NOTIFICATIONS)) {
        db.createObjectStore(STORE_NOTIFICATIONS, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// --- Generic IDB helpers ---

function idbPut(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
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

function idbClear(store: IDBObjectStore): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Document list cache ---

/** Cache the full document list for offline dashboard access. */
export async function cacheDocumentList(docs: CachedDocEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_DOC_LIST, 'readwrite');
  const store = tx.objectStore(STORE_DOC_LIST);
  await idbClear(store);
  const now = Date.now();
  for (const doc of docs) {
    await idbPut(store, { ...doc, cached_at: now });
  }
}

/** Retrieve cached document list for offline display. */
export async function getCachedDocumentList(): Promise<CachedDocEntry[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_DOC_LIST, 'readonly');
  return idbGetAll<CachedDocEntry>(tx.objectStore(STORE_DOC_LIST));
}

// --- Sidebar state persistence ---

/** Save a sidebar state entry (e.g., recent docs, starred items). */
export async function saveSidebarState(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_SIDEBAR, 'readwrite');
  await idbPut(tx.objectStore(STORE_SIDEBAR), { key, value, updated_at: Date.now() });
}

/** Load a sidebar state entry by key. */
export async function loadSidebarState<T = unknown>(key: string): Promise<T | null> {
  const db = await getDB();
  const tx = db.transaction(STORE_SIDEBAR, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_SIDEBAR).get(key);
    req.onsuccess = () => {
      const entry = req.result as SidebarEntry | undefined;
      resolve(entry ? (entry.value as T) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

// --- Notification state persistence ---

/** Save notifications for offline viewing. */
export async function cacheNotifications(notifications: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NOTIFICATIONS, 'readwrite');
  const store = tx.objectStore(STORE_NOTIFICATIONS);
  await idbClear(store);
  for (const n of notifications) {
    await idbPut(store, n);
  }
}

/** Retrieve cached notifications. */
export async function getCachedNotifications(): Promise<unknown[]> {
  const db = await getDB();
  const tx = db.transaction(STORE_NOTIFICATIONS, 'readonly');
  return idbGetAll(tx.objectStore(STORE_NOTIFICATIONS));
}
