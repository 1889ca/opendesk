# Contract: Storage

## Purpose

Abstract document persistence behind a unified `DocumentRepository` interface, transparently managing hot/cold storage tiering between PostgreSQL and S3.

## Inputs

- `docId`: `string` — unique document identifier
- `snapshot`: `DocumentSnapshot` (JSON) — materialized document state
- `stateVector`: `Uint8Array` — Yjs state vector, co-persisted atomically with snapshot
- `binary`: `Buffer` — raw Yjs CRDT binary blob, stored separately from snapshot

## Outputs

- `getSnapshot` returns `{ snapshot, revisionId, staleSeconds? } | null` — `staleSeconds` is present when served from cold storage, indicating seconds since the document was archived
- `getYjsBinary` returns `Buffer | null` — the raw Yjs binary for a document
- `archiveToCold` / `warmFromCold` — no return value; internal tier transitions observable via `staleSeconds` on subsequent reads

## Side Effects

- Reads/writes rows in PostgreSQL (hot tier for active documents)
- Reads/writes objects in S3-compatible storage (cold tier for archived documents)
- Moves data between tiers based on the internal lifecycle policy
- Prunes state vector entries for clients offline longer than 30 days

## Invariants

- Snapshot and state vector are always persisted atomically: a crash between writing one and the other must not leave the database in an inconsistent state
- A `getSnapshot` call always returns data regardless of which tier holds it; callers never specify or know the tier
- `staleSeconds` is populated if and only if the document was served from cold storage
- State vector entries for clients offline > 30 days are pruned on write (not retroactively)
- The Yjs binary blob and the materialized DocumentSnapshot JSON are stored in separate storage paths and never conflated
- `getSnapshot` after a successful `saveSnapshot` for the same `docId` returns the saved data (read-your-writes consistency within the hot tier)

## Dependencies

- None at the contract level. PostgreSQL and S3 clients are internal adapter details.

## Boundary Rules

- MUST: co-persist snapshot and state vector atomically (single transaction in PG, atomic put in S3)
- MUST: prune state vector entries for clients offline > 30 days during `saveSnapshot`
- MUST: transparently handle hot/cold retrieval so callers never specify a tier
- MUST: return `staleSeconds` indicator when serving from cold storage
- MUST: keep Yjs binary and DocumentSnapshot JSON in separate storage paths
- MUST NOT: understand document semantics (this module stores opaque blobs and typed snapshots, nothing more)
- MUST NOT: emit events or trigger side effects beyond persistence (that is the caller's responsibility)
- MUST NOT: perform schema migrations (the `document` module owns schema evolution)
- MUST NOT: expose adapter internals (PG connection pools, S3 clients) outside this module — **partially fixed (#134)**: `pool` and `getPool` are no longer exported from `modules/storage/index.ts`. The composition root (`modules/api/internal/server.ts`, `create-routes.ts`) and a small set of pg-* stores in `modules/kb/`, `modules/references/`, and `modules/ai/` still reach in via the cross-module-internal path `modules/storage/internal/pool.ts`. The proper fix is converting each pg-* store into a factory that takes the pool via constructor injection so the pool flows from the composition root. Tracked as a follow-up.

## Verification

How to test each invariant:

- Atomic co-persistence: simulate a crash (kill transaction mid-write) and verify neither snapshot nor state vector is partially written; use a transactional test harness that rolls back on injected failure
- Tier-transparent retrieval: archive a document to cold, then call `getSnapshot` and verify it returns data with `staleSeconds` populated; call `warmFromCold` and verify `staleSeconds` is absent on next read
- State vector pruning: save a snapshot with state vector entries containing client timestamps > 30 days old, then read back and verify those entries are absent
- Separate storage paths: save both a snapshot and a Yjs binary for the same doc, then independently verify each is retrievable and stored at distinct keys/rows
- Read-your-writes: call `saveSnapshot` then immediately `getSnapshot` for the same `docId` and assert equality
- Cold storage staleness: archive a document, wait a known duration, retrieve it, and verify `staleSeconds` reflects elapsed time within acceptable tolerance

## MVP Scope

Implemented:
- [x] PostgreSQL persistence for documents (hot tier)
- [x] Yjs binary blob storage (separate from snapshot)
- [x] Read-your-writes consistency within PG
- [x] Functions exported directly (saveSnapshot, getSnapshot, getYjsBinary, etc.)

Post-MVP (deferred):
- [x] `DocumentRepository` interface abstraction — `createDocumentRepository()` in `pg-document-repository.ts`
- [x] S3-compatible cold storage tier — `cold-storage.ts` + migration 016
- [x] Hot/cold tiering lifecycle policy (archiveToCold / warmFromCold) — `archiveStaleDocuments` in `cold-storage.ts`
- [x] `staleSeconds` indicator on cold-tier reads — returned by `getSnapshot` when tier='cold'
- [x] Atomic snapshot + state vector co-persistence in a single PG transaction — `saveSnapshot` wraps both in `BEGIN/COMMIT` (#014 migration)
- [x] State vector pruning for clients offline > 30 days — `pruneStateVector` in `pg-document-repository.ts`
- [x] Remove direct `pool`/`getPool` exports from `storage/index.ts` (#134, partial)
- [ ] Convert pg-* stores in `modules/kb/`, `modules/references/`, and `modules/ai/` from module-scope `pool` imports to factory + DI so the cross-module-internal access goes away (#134 follow-up)
