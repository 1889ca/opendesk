# Purge Compaction Contract

## Purpose

Destroys all CRDT history and tombstones by materializing current content into a fresh Yjs document, producing the smallest possible binary state.

## Inputs / Outputs

**Input:** `documentId: string`, `storage: StorageAdapter`

**Output:** `PurgeResult { documentId, originalSize, purgedSize, durationMs }`

## How It Differs From Regular Compaction

| Aspect | Regular Compaction | Purge Compaction |
|--------|-------------------|------------------|
| Thread | `worker_threads` (off main thread) | **Main thread** (intentional) |
| History | Re-encodes same doc (preserves history) | Creates fresh doc (destroys all history) |
| Tombstones | Retained | Eliminated |
| Result | Smaller but same logical structure | Brand-new Yjs Doc with fresh client ID |
| Use case | Routine size management | GDPR erasure, storage reclamation |

**Main-thread execution is intentional**: purge is an infrequent administrative operation (not routine), so the overhead of worker thread setup is unnecessary. This is a deliberate deviation from the regular compaction contract.

## Algorithm

1. Load Yjs binary state from storage
2. Apply state to a source `Y.Doc` to materialize content
3. `extractContent()` — detect shared type kinds (text, map, array) via internal structure inspection (`_map`, `_start`, content constructor names), extract live values
4. Create a fresh `Y.Doc` with a new client ID
5. `applyContent()` — populate fresh doc from snapshot in a single transaction
6. Encode fresh doc and atomically replace the stored state

## Invariants

- MUST: produce a Yjs document with zero tombstones and zero operation history
- MUST: preserve all live content (texts, maps, arrays, XML fragments)
- MUST: atomically replace the old state in storage (no partial writes)
- MUST: throw if the document is not found in storage
- MUST: detect shared type kinds by inspecting Yjs internals (`_map.size`, `_start.content.constructor.name`) since `applyUpdate` creates `AbstractType` instances, not typed subclasses
- MUST: default unknown/empty shared types to `text` (most common case)
- MUST: run on main thread (not `worker_threads`) — this is intentional for an infrequent admin operation
- MUST NOT: preserve CRDT history, deleted content, or tombstones
- MUST NOT: be used for routine compaction (use regular compaction instead)

## Known Limitations

- **Formatting loss**: Rich text formatting (bold, italic, etc.) stored as Yjs `ContentFormat` items is not preserved during extraction. Plain text content is extracted but marks are lost. This is a known issue documented in the implementation.
- **XmlFragment handling**: XML fragments are re-created as `XmlText` nodes, which may lose structural information.

## Dependencies

- `yjs` — `Y.Doc`, `Y.applyUpdate`, `Y.encodeStateAsUpdate`, shared type APIs
- `compaction-manager` — `StorageAdapter` interface for `loadYjsState` / `saveYjsState`

## Verification

- Unit test: purge a doc with history, verify `purgedSize < originalSize`
- Unit test: purge a doc, verify all text content is preserved
- Unit test: purge a doc with maps and arrays, verify entries preserved
- Unit test: purge non-existent doc throws error
- Unit test: `extractContent` correctly detects text vs map vs array types
- Unit test: `applyContent` produces a valid Yjs doc from a snapshot

## MVP Scope

Implemented:
- [x] Full purge compaction (fresh doc with zero history)
- [x] Content extraction for texts, maps, arrays, XML fragments
- [x] Shared type kind detection via Yjs internals
- [x] Atomic storage replacement
- [x] Duration and size tracking in `PurgeResult`

Post-MVP:
- [ ] Preserve rich text formatting (ContentFormat items) during extraction
- [ ] Preserve XmlFragment structure (not just text content)
