# Contract: collab

## Purpose

Real-time collaborative editing server: manages Hocuspocus/Yjs WebSocket connections, materializes CRDT state to persistent DocumentSnapshot JSON, and executes agent intents against documents via optimistic concurrency control.

## Subsystems

This module contains four behavioral subsystems. Each has its own inputs, outputs, and invariants documented below.

### 1. Hocuspocus WebSocket Server

Server-only Yjs CRDT synchronization over WebSocket. Mounted by the `api` module via an upgrade handler export.

### 2. Document Materializer

Converts Yjs binary state to `DocumentSnapshot` JSON for downstream consumption (search, export, API reads). Runs debounced and on-demand.

### 3. IntentExecutor

Validates and applies `DocumentIntent` submissions from agents using optimistic concurrency control. Translates high-level intents into Yjs operations targeting stable block IDs.

### 4. Awareness Protocol

Broadcasts cursor positions and user presence metadata over the Yjs awareness channel.

---

## Inputs

### WebSocket Server

- `WebSocket upgrade request`: HTTP upgrade with auth token -- authenticated by `auth` module before handshake completes
- `Yjs sync messages`: binary CRDT updates from connected clients

### IntentExecutor

- `DocumentIntent`: `{ documentId, idempotencyKey, baseRevision, operations[] }` -- submitted by agents via `api` module
  - `baseRevision`: `string` -- state vector hash at time of agent's last read
  - `operations[].targetBlockId`: `string` -- stable block ID (NOT JSON path)
  - `operations[].type`: `'insertAfter' | 'replace' | 'delete' | 'updateAttributes'`
  - `operations[].payload`: operation-specific data validated against `document` module's intent schema

### Materializer

- `Yjs binary state`: raw CRDT document state from Hocuspocus
- `flush-on-demand event`: emitted by `convert` module (or any subscriber) requesting immediate materialization

### Awareness

- `awareness update messages`: cursor position, selection range, user metadata from connected clients

---

## Outputs

### WebSocket Server

- `WebSocket upgrade handler`: `(request, socket, head) => void` -- exported for `api` module to mount
- `Active connection metadata`: document ID, principal, connection timestamp (queryable for admin/debug)

### IntentExecutor

- **On success**: `{ revisionId: string, appliedOperations: number }` -- new state vector hash after apply
- **On stale revision (409)**: `{ code: 'STALE_REVISION', baseRevision: string, currentRevision: string, currentStateVector: Uint8Array }`
- **On duplicate idempotency key**: `{ code: 'DUPLICATE_INTENT', originalRevisionId: string }`

### Materializer

- `DocumentSnapshot`: JSON conforming to `document` module's discriminated union schema, persisted to `storage`
- `StateFlushed` event: emitted via `events` module after successful atomic persistence of snapshot + state vector

### Awareness

- Broadcast awareness state to all connected peers on the same document

---

## Side Effects

- **Persists Yjs binary state** to `storage` on every CRDT update (append to operation journal)
- **Persists DocumentSnapshot + state vector** atomically on materialization (debounced or on-demand)
- **Emits `DocumentUpdated` event** via `events` module when CRDT state changes
- **Emits `StateFlushed` event** via `events` module after successful materialization
- **Caches idempotency keys** for 24 hours (storage-backed, survives restart)
- **Drops WebSocket connections** on `GrantRevoked` events for affected principals
- **Discards queued intents** for revoked principals on `GrantRevoked` events
- **Runs CRDT compaction** in `worker_threads` when document exceeds compaction threshold

---

## Invariants

### WebSocket Server

- Every WebSocket connection MUST be authenticated before the handshake completes. Unauthenticated upgrades receive immediate 401 and socket destruction.
- A connection MUST be associated with exactly one document ID and one principal for its entire lifetime.
- Connections for revoked principals MUST be dropped within pub/sub latency of the `GrantRevoked` event.

### IntentExecutor

- An intent MUST be rejected with 409 if the target block has been modified since `baseRevision`.
- Block targeting MUST use Yjs `relativePosition` resolved from stable block IDs. JSON paths are never used.
- Idempotency keys MUST be cached for 24 hours. Duplicate submissions return the original result, not a new apply.
- Intent application MUST be atomic: all operations in a single intent succeed or none are applied.
- MVP intent routing is a direct function call from `api` to `collab` (single-node). No network hop.

### Materializer

- Materialization MUST be debounced: triggers after N milliseconds of inactivity OR after M operations, whichever comes first. Both N and M are configurable.
- Snapshot and state vector MUST be persisted atomically. A snapshot without its corresponding state vector (or vice versa) is a corruption bug.
- Schema migration MUST be applied during materialization if the document's `schemaVersion` is behind the current version, using `document` module's migration registry.
- Flush-on-demand MUST bypass the debounce timer and materialize immediately.

### CRDT Compaction

- Compaction MUST run in a `worker_threads` thread. Running compaction on the main thread is a contract violation.
- Compaction MUST NOT alter the logical document state. The Yjs document before and after compaction MUST produce identical `DocumentSnapshot` output.

### Crash Recovery

- The operation journal MUST contain sufficient state to reconstruct any document to its last-persisted state vector.
- On startup, collab MUST replay the operation journal for any document whose journal entries exist beyond the last persisted state vector.

### General

- This module MUST NOT export any browser-compatible code. All exports are server-only. If a consumer can `import` this module in a browser bundle, the boundary is wrong.
- This module MUST NOT evaluate permissions directly. Access control is enforced at the `api` boundary; revocation is handled via `GrantRevoked` event subscription.
- This module MUST NOT validate individual Yjs binary updates against Zod schemas per-keystroke. Validation occurs during periodic materialization only.

---

## Dependencies

- `document` -- `DocumentSnapshot` type, `DocumentIntent` Zod schema, `SchemaVersion` enum, migration registry for snapshot upgrades
- `storage` -- persist and retrieve Yjs binary state, DocumentSnapshot JSON, operation journal entries, idempotency key cache
- `events` -- emit `DocumentUpdated` and `StateFlushed` events; subscribe to `GrantRevoked` events for connection teardown
- `auth` -- `Principal` type for connection authentication and intent attribution

---

## Boundary Rules

- MUST: run CRDT compaction in `worker_threads`, never on the main event loop
- MUST: persist an operation journal entry for every CRDT update (crash recovery source of truth)
- MUST: expose a WebSocket upgrade handler for `api` module to mount (not start its own HTTP server)
- MUST: support flush-on-demand for export workflows (bypass debounce, materialize immediately)
- MUST: return 409 with `{ code, baseRevision, currentRevision, currentStateVector }` on stale intent submissions
- MUST: drop connections and discard queued intents within pub/sub latency of `GrantRevoked` events
- MUST: persist snapshot and state vector atomically (single transaction)
- MUST: replay operation journal on startup for documents with un-persisted state
- MUST: cache idempotency keys for 24 hours and reject duplicate intent submissions
- MUST NOT: export any browser-compatible code (server-only module)
- MUST NOT: evaluate permissions directly (rely on `api` boundary checks and `GrantRevoked` subscriptions)
- MUST NOT: validate Yjs binary updates against Zod schemas per-keystroke (materialization-time only)
- MUST NOT: start its own HTTP/WebSocket listener (upgrade handler is mounted by `api`)
- MUST NOT: use JSON paths to target blocks (stable block IDs via Yjs `relativePosition` only)
- MUST NOT: run multi-node coordination in MVP (single-node Hocuspocus, no Redis leader election)

---

## Known Limitations (MVP)

- **Post-revocation CRDT operations**: Yjs uses an append-only DAG. Operations applied between a principal's last authorized action and the `GrantRevoked` connection drop cannot be rolled back. This is a known limitation accepted in Decision #003.
- **Single-node only**: No Redis-backed multi-node Hocuspocus. Horizontal scaling is Phase 2.
- **Single revision clock**: OCC uses a single `revisionId` (state vector hash), not a dual-clock system. Sufficient for MVP concurrency semantics.
- **Intent routing is in-process**: Direct function call from `api` to `collab`. Redis channel-based routing for multi-node is Phase 2.

---

## Verification

How to test each invariant:

- **Unauthenticated WebSocket rejection** -- attempt upgrade without valid token, assert 401 and socket destroyed within one tick
- **Connection-principal binding** -- open connection, verify principal metadata is immutable for connection lifetime
- **GrantRevoked connection drop** -- establish connection, emit `GrantRevoked` for that principal, assert WebSocket closed within pub/sub latency window
- **Intent OCC (fresh)** -- submit intent with current `baseRevision`, assert success and new `revisionId` returned
- **Intent OCC (stale)** -- modify document, submit intent with old `baseRevision`, assert 409 with correct `currentRevision` and `currentStateVector`
- **Intent idempotency** -- submit same `idempotencyKey` twice, assert second returns original result without re-applying
- **Intent atomicity** -- submit intent with one valid and one invalid operation, assert zero operations applied
- **Block targeting via relativePosition** -- insert block, record its stable ID, insert content before it, verify intent still resolves to correct block
- **Materializer debounce** -- apply updates, assert no snapshot persisted before debounce window, assert snapshot persisted after window expires
- **Materializer flush-on-demand** -- request flush, assert snapshot persisted immediately regardless of debounce timer state
- **Atomic snapshot persistence** -- kill process mid-materialization, restart, verify no partial snapshot exists (journal replay recovers)
- **Schema migration during materialization** -- create document at old schema version, trigger materialization, verify snapshot at current schema version
- **Compaction thread safety** -- trigger compaction, verify it runs in worker thread (not main), verify document state unchanged after compaction
- **Crash recovery** -- write operations, kill process before materialization, restart, verify document state matches pre-crash state via journal replay
- **No browser exports** -- attempt to bundle this module with a browser-targeted bundler, assert failure or zero collab exports in output
- **No per-keystroke Zod validation** -- apply rapid CRDT updates, verify Zod validation only runs during materialization cycles
