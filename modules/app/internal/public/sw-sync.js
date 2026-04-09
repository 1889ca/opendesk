/** Contract: contracts/app/offline.md */

/**
 * Background sync handler for the service worker.
 * Replays queued mutations from IndexedDB when connectivity returns.
 */

// --- Background sync for queued mutations ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'opendesk-sync') {
    event.waitUntil(flushMutationQueue());
  }
});

/** Replay queued mutations from IndexedDB. */
async function flushMutationQueue() {
  const db = await openSyncDB();
  const tx = db.transaction('mutations', 'readonly');
  const entries = await idbGetAll(tx.objectStore('mutations'));

  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      if (response.ok || response.status < 500) {
        const delTx = db.transaction('mutations', 'readwrite');
        delTx.objectStore('mutations').delete(entry.id);
        await idbComplete(delTx);
      }
    } catch {
      break; // Still offline
    }
  }
  db.close();
}

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('opendesk-sync', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
