# Decision: Should OpenDesk use Yjs or Automerge for CRDT-based real-time collaboration?

**Date**: 2026-04-06
**Status**: Accepted
**Deliberation**: 2026-04-06-should-opendesk-use-yjs-or-automerge-for-crdt-based-real-tim-deliberation.md

## Context

OpenDesk needs a CRDT library for real-time collaborative document editing. The MVP uses TipTap (ProseMirror-based) with a Node.js/WebSocket backend, PostgreSQL + S3 storage, and must be self-hostable under AGPL-3.0. Phase 1 is documents only; Phase 2 adds spreadsheets.

## Decision

Use Yjs with Hocuspocus for Phase 1, committing fully without an abstraction layer.

## Consequences

- TipTap's `@tiptap/extension-collaboration` and Hocuspocus are built on Yjs — first-class integration, not a third-party binding
- `y-prosemirror` provides battle-tested ProseMirror document mapping
- `Y.UndoManager` handles collaborative undo natively
- `y-protocols/awareness` provides cursor/presence without custom infrastructure
- Pure JavaScript — no WASM, runs anywhere Node runs, simplifies self-hosting
- All dependencies (Yjs, Hocuspocus, y-protocols, lib0) are MIT licensed — clean under AGPL-3.0
- Automerge's Peritext mark semantics are theoretically superior but the ProseMirror binding doesn't exist — building it is a multi-month project incompatible with MVP timeline

## Architectural Constraints Identified

1. **CRDT compaction is synchronous** — must offload `Y.applyUpdate` consolidation to `worker_threads` to avoid blocking the Node.js event loop
2. **PostgreSQL/S3 tiering requires co-persisting the state vector** alongside each snapshot for safe GC and client reconnection
3. **Crash recovery needs an operation journal** — logging every applied update with its state vector before broadcasting, to enable replay after server crashes
4. **Server-side validation uses counter-operations** — not rejection (which breaks CRDT state vectors), with ProseMirror origin-based decorations to mask latency
5. **Phase 2 spreadsheets should use a flat `Y.Map`** (coordinate keys to primitives/IDs) with a separate `Y.XmlText` pool for cells requiring rich text collaboration

## Required Validation Before Phase 1 Launch

- Adversarial test suite for `y-prosemirror` mark semantics (concurrent bold/italic operations)
- Network partition recovery tests (Toxiproxy between Hocuspocus and clients)
- Event loop lag measurement during CRDT compaction (50k-100k updates)
- Crash-between-broadcast-and-persist recovery rate testing

## Deliberation Summary

Three models participated (Claude, Gemini, DeepSeek) across 6 rounds. Unanimous agreement on Yjs for Phase 1. Key debate points:

**For Yjs**: TipTap ecosystem integration, Y.UndoManager, awareness protocol, pure JS (no WASM), Hocuspocus with PostgreSQL persistence, MIT license compatibility
**For Automerge**: Peritext mark semantics, immutable change log (simpler crash recovery), potentially better memory model for dense spreadsheet grids
**Against Automerge**: No ProseMirror binding, WASM requirement complicates self-hosting (especially ARM), no awareness protocol, younger Node.js server infrastructure

The deliberation also produced the Phase 2 spreadsheet architecture (flat Y.Map + Y.XmlText pool) and identified the Node.js event loop blocking risk during CRDT compaction — both novel findings that emerged from multi-model debate.
