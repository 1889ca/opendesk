/** Contract: contracts/app/offline.md */

/**
 * OpenDesk Service Worker
 * - Network-first for JS/CSS bundles (ensures fresh code after rebuilds)
 * - Network-first for API calls with cache fallback
 * - Cache-first for immutable assets (images, fonts)
 * - Versioned cache names for clean upgrades
 * - LRU eviction for API cache
 */

importScripts('./sw-sync.js');

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `opendesk-static-${CACHE_VERSION}`;
const API_CACHE = `opendesk-api-${CACHE_VERSION}`;
const API_CACHE_LIMIT = 100;

const PRECACHE_URLS = [
  '/', '/index.html', '/editor.html',
  '/spreadsheet.html', '/presentation.html', '/share.html',
];

/** Assets that change on every rebuild — must use network-first. */
const MUTABLE_EXT = /\.(js|css|html)$/;
/** Immutable assets (images, fonts) — safe to cache-first. */
const IMMUTABLE_EXT = /\.(png|jpe?g|gif|svg|ico|woff2?)$/;

function isApi(url) { return new URL(url).pathname.startsWith('/api/'); }

/** Trim API cache to LRU limit. */
async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// --- Install: precache critical routes, activate immediately ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
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

  const pathname = new URL(request.url).pathname;

  if (isApi(request.url)) {
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (MUTABLE_EXT.test(pathname)) {
    // JS, CSS, HTML — always try network first so rebuilds take effect
    event.respondWith(networkFirst(request, STATIC_CACHE));
  } else if (IMMUTABLE_EXT.test(pathname)) {
    // Images, fonts — safe to serve from cache
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(navigation(request));
  }
});

/** Network-first: try network, fall back to cache. */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      if (cacheName === API_CACHE) trimCache(API_CACHE, API_CACHE_LIMIT);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** Cache-first: serve from cache, update in background (immutable assets only). */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
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
