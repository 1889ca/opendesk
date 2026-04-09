/** Contract: contracts/app/offline.md */

/**
 * OpenDesk Service Worker
 * - Cache-first for static assets (JS, CSS, HTML, images)
 * - Network-first for API calls with cache fallback
 * - Versioned cache names for clean upgrades
 * - LRU eviction for API cache
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `opendesk-static-${CACHE_VERSION}`;
const API_CACHE = `opendesk-api-${CACHE_VERSION}`;
const API_CACHE_LIMIT = 100;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/editor.html',
  '/spreadsheet.html',
  '/presentation.html',
  '/share.html',
];

const STATIC_EXTENSIONS = [
  '.js', '.css', '.html', '.png', '.jpg', '.jpeg',
  '.gif', '.svg', '.ico', '.woff', '.woff2',
];

function isStaticAsset(url) {
  const path = new URL(url).pathname;
  return STATIC_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function isApiRequest(url) {
  return new URL(url).pathname.startsWith('/api/');
}

/** Trim API cache to LRU limit by deleting oldest entries. */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  const toDelete = keys.slice(0, keys.length - maxItems);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}

// --- Install: precache critical routes ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// --- Activate: purge old versioned caches ---
self.addEventListener('activate', (event) => {
  const currentCaches = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('opendesk-') && !currentCaches.has(name))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch: route to cache strategy ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip WebSocket upgrade requests
  if (request.headers.get('upgrade') === 'websocket') return;

  if (isApiRequest(request.url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Navigation requests: try network, fall back to cached index
    event.respondWith(navigationStrategy(request));
  }
});

/** Cache-first: serve from cache, update in background. */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Background update
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, response));
      }
    }).catch(() => { /* offline, skip update */ });
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** Network-first: try network, fall back to cache. */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      trimCache(API_CACHE, API_CACHE_LIMIT);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Navigation: network first, fall back to cached shell. */
async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fall back to index for SPA routing
    const index = await caches.match('/index.html');
    if (index) return index;
    return new Response('Offline', { status: 503 });
  }
}

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
  const store = tx.objectStore('mutations');
  const entries = await idbGetAll(store);

  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      if (response.ok || response.status < 500) {
        // Success or client error (don't retry) — remove from queue
        const delTx = db.transaction('mutations', 'readwrite');
        delTx.objectStore('mutations').delete(entry.id);
        await idbComplete(delTx);
      }
    } catch {
      // Still offline, stop flushing — will retry on next sync
      break;
    }
  }
  db.close();
}

// --- Minimal IndexedDB helpers for the SW scope ---

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

// --- Message handling for skip-waiting ---
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
