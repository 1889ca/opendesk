# Contract: app/offline

## Purpose

Provide offline-first capabilities for OpenDesk: service worker caching of static assets and API responses, IndexedDB persistence for document data and UI state, connection status detection, and background sync for queued mutations. This is a sub-contract of `contracts/app/rules.md`.

## Inputs

- `navigator.onLine` and `online`/`offline` window events for connectivity detection
- WebSocket connection state from HocuspocusProvider (`onConnect`/`onDisconnect`)
- Static assets from the build pipeline (JS bundles, CSS, HTML pages)
- API responses from `/api/documents` and related endpoints
- Yjs document state from in-memory CRDT operations

## Outputs

- Service worker (`sw.js`) that intercepts fetch requests and serves cached responses when offline
- Visual indicators: "Offline", "Syncing...", "Synced", "Update available" states
- IndexedDB stores for: cached document list, sidebar state (recent/starred docs), notification state
- Background sync queue for mutations made while offline

## Side Effects

- Registers a service worker at application startup
- Populates browser Cache Storage with static assets and API responses
- Reads/writes IndexedDB for document list cache and UI state persistence
- Listens for `online`/`offline` events and WebSocket state changes
- Shows update notification when a new service worker version is waiting

## Invariants

1. **Cache-first for statics.** JS bundles, CSS files, HTML pages, and images are served cache-first. Network responses update the cache in the background.
2. **Network-first for APIs.** API calls attempt network first, falling back to cached responses when offline.
3. **Versioned caches.** Cache names include a version string. Old caches are purged on service worker activation.
4. **No data loss.** Mutations made while offline are queued in IndexedDB and replayed when connectivity returns. Queue entries include idempotency keys to prevent duplicates.
5. **CRDT merge on reconnect.** Yjs handles document merge automatically via CRDT. No manual conflict resolution is needed. The offline module only manages the connection indicator, not Yjs sync.
6. **LRU eviction.** API response cache has a size limit. Oldest entries are evicted when the limit is reached.
7. **Graceful degradation.** If service workers or IndexedDB are unavailable, the app works normally without offline support. No errors thrown.
8. **Yjs document persistence.** The Yjs `Doc` bound to each open editor MUST be mirrored to IndexedDB via a local persistence provider. Updates applied while offline are written locally before any network send, so a reload during a disconnect does not lose work. On reopen, the local store is replayed into the `Doc` before the Hocuspocus provider connects, so the state vector sent to the server already contains offline edits.
9. **Reconnect merge contract.** On `provider.on('connect')`, the client MUST NOT clear its local persistence until the provider emits `synced`. The merge order is: (a) replay IndexedDB into `Doc`, (b) open WebSocket, (c) Yjs sync protocol exchanges state vectors, (d) server and client converge via CRDT, (e) local store receives new updates and persists them. No step may be skipped or reordered.
10. **Per-document IndexedDB database.** Each document MUST use an isolated IndexedDB database keyed by `opendesk-yjs-<documentId>` so that clearing one document's offline state does not affect others. Workspace-level erasure (see `modules/erasure`) MUST be able to enumerate and drop these databases.

## Dependencies

- `app/rules.md` (parent contract)
- Browser Service Worker API
- Browser Cache API
- Browser IndexedDB API
- `navigator.onLine` and connectivity events

## File Structure

```
modules/app/internal/
  public/sw.js                    -- Service worker (plain JS, not bundled)
  offline/
    sw-register.ts                -- SW registration + update notification
    offline-indicator.ts          -- Connection status UI component
    offline-storage.ts            -- IndexedDB helpers for document cache + state
    sync-manager.ts               -- Mutation queue + background flush
    yjs-persistence.ts            -- Per-document IndexedDB provider for Yjs docs
  css/
    offline.css                   -- Offline indicator + update banner styles
```

## Verification

1. **Cache-first statics** -- Load app, go offline, reload. Static assets serve from cache.
2. **Network-first API** -- Load doc list, go offline, reload. Cached list appears with offline badges.
3. **Versioned caches** -- Deploy new version, old cache is cleaned up on activation.
4. **No data loss** -- Edit document offline, reconnect. Changes sync via Yjs CRDT.
5. **Mutation queue** -- Create/delete document offline, reconnect. Queued mutations replay.
6. **LRU eviction** -- Cache many API responses, verify oldest are evicted past limit.
7. **Graceful degradation** -- Disable service workers in browser, verify app works normally.
8. **Yjs offline persistence** -- Open doc, disconnect, type N paragraphs, reload page while still disconnected, verify paragraphs are still present in the editor.
9. **Yjs reconnect merge** -- With two clients A and B online, disconnect A, edit both A (offline) and B (online), reconnect A, verify both sets of edits are present in both clients' `Doc` after `synced`.
10. **Per-document isolation** -- Edit doc X and Y offline, drop doc X's IndexedDB database, verify doc Y's offline state is untouched.
