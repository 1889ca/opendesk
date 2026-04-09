/** Contract: contracts/app/offline.md */

/**
 * OpenDesk Service Worker
 * - Cache-first for static assets (JS, CSS, HTML, images)
 * - Network-first for API calls with cache fallback
 * - Versioned cache names for clean upgrades
 * - LRU eviction for API cache
 */

importScripts('./sw-sync.js');

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `opendesk-static-${CACHE_VERSION}`;
const API_CACHE = `opendesk-api-${CACHE_VERSION}`;
const API_CACHE_LIMIT = 100;

const PRECACHE_URLS = [
  '/', '/index.html', '/editor.html',
  '/spreadsheet.html', '/presentation.html', '/share.html',
];

const STATIC_EXT = /\.(js|css|html|png|jpe?g|gif|svg|ico|woff2?)$/;

function isStatic(url) { return STATIC_EXT.test(new URL(url).pathname); }
function isApi(url) { return new URL(url).pathname.startsWith('/api/'); }

/** Trim API cache to LRU limit. */
async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// --- Install: precache critical routes ---
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS)));
});

// --- Activate: purge old versioned caches ---
self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n.startsWith('opendesk-') && !keep.has(n)).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// --- Fetch: route to cache strategy ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.headers.get('upgrade') === 'websocket') return;

  if (isApi(request.url)) {
    event.respondWith(networkFirst(request));
  } else if (isStatic(request.url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(navigation(request));
  }
});

/** Cache-first: serve from cache, update in background. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then((r) => {
      if (r.ok) caches.open(STATIC_CACHE).then((c) => c.put(request, r));
    }).catch(() => {});
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
async function networkFirst(request) {
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
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** Navigation: network first, fall back to cached shell. */
async function navigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request))
      || (await caches.match('/index.html'))
      || new Response('Offline', { status: 503 });
  }
}

// --- Message handling for skip-waiting ---
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
