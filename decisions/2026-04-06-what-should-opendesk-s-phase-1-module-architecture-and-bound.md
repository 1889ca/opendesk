# Decision: Phase 1 Module Architecture and Boundaries

**Date**: 2026-04-06
**Status**: Accepted
**Deliberation**: 2026-04-06-what-should-opendesk-s-phase-1-module-architecture-and-bound-deliberation.md

## Context

OpenDesk needs a modular architecture for Phase 1 (collaborative document editor) that is highly modular, highly extensible, and anticipates future agentic connectivity. The architecture must support contracts-first development where AI agents are the primary contributors.

## Decision

### Module Map

```
Kernel (no domain dependencies, initialize first):
  auth          - identity resolution, OIDC, principals with actorType (human|agent|system)
  storage       - abstract repository + hot/cold lifecycle (PG adapters + S3 adapters internal)
  events        - typed thin events, PG transactional outbox, Redis pub/sub backplane

Document Domain:
  document      - DocumentSnapshot discriminated union, Zod schemas, SchemaVersion + migration registry, DocumentIntent schema
  collab        - Hocuspocus/Yjs (server-only), materializer, IntentExecutor with OCC, document-owner via Redis

Access Domain:
  permissions   - ACL model + evaluation (checked at API boundary, async revocation via GrantRevoked events)
  sharing       - grant management, link generation (writes to permissions store)

Integration:
  convert       - LibreOffice microservice, depends on events (request flush before export), can fail independently
  api           - REST + SSE only, mounts collab's WS upgrade handler, Zod validation at boundary, agent rate limiting
  app           - frontend shell, TipTap/Yjs binding, awareness UI, i18n (build-time convention, not a module)
```

### Key Architectural Decisions

**DocumentSnapshot as lingua franca**: The single most load-bearing type in the system. Discriminated union with `documentType` field from day one (Phase 1 has one member: `text`). Includes `schemaVersion` for forward-compatible migration.

```typescript
type DocumentSnapshot = TextDocumentSnapshot; // union grows in Phase 2+
type TextDocumentSnapshot = {
  documentType: 'text';
  schemaVersion: TextSchemaVersion;
  content: ProseMirrorJSON;
}
```

**Thin events (not fat)**: PG NOTIFY has 8KB limit. Events carry only `aggregateId` + `revisionId`. Subscribers fetch payloads from storage. Transactional outbox with 7-day TTL for guaranteed delivery.

**OCC for agent writes**: Agents submit intents with `baseRevision`. If the target content has changed since that revision, `IntentExecutor` returns 409 Conflict with `currentRevision` + `currentStateVector` for delta computation. Agents must re-read and reformulate. This matches Google Docs/Notion/Confluence API semantics.

**Redis is a hard production dependency**: Hocuspocus already requires it for multi-node via `@hocuspocus/extension-redis`. Intent routing uses per-document Redis channels. Dev can use in-memory simulation.

**collab is server-only**: Frontend TipTap/Yjs binding lives in `app` as wiring, not a module. If `collab` exports browser-compatible code, the boundary is wrong.

**i18n is a build-time convention, not a module**: Translation keys co-located with their UI components. No runtime module boundary.

**permissions must be Phase 1**: Required for intent pipeline access control. Uses async revocation via `GrantRevoked` events (not synchronous check in CRDT apply path, which would block the event loop).

**Zod contracts**: Every module's `contract.ts` uses Zod schemas for runtime + compile-time validation. Types inferred from schemas. This fulfills contracts-first at both levels.

**Agent integration via existing surfaces**: Auth (service account principals), REST (DocumentSnapshot reads), SSE (event observation at `GET /api/events/stream`), and Intent submission (POST with OCC). The only agent-specific concession is `actorType` field on principals and events.

### Module Structure Convention

```
modules/
  <module>/
    contract.ts       -- Zod schemas + inferred types (max 200 lines)
    index.ts          -- public exports only
    internal/         -- implementation files (private to module)
```

External modules may only import `contract.ts` (types) and `index.ts` (instantiation). If `contract.ts` exceeds 200 lines, the module must be split.

### Dependency Rules

- Strictly downward. No cycles.
- Each layer testable in isolation against the layer below.

### What Was Explicitly Deferred

- Offline editing (app-layer concern, Phase 2)
- Webhook delivery (SSE sufficient for Phase 1)
- Telemetry/observability module (correct but premature decomposition; structured logging with W3C traceparent sufficient for Phase 1)
- Workflow orchestration for multi-step agent operations
- Bidirectional schema migration during active editing sessions

## Consequences

- 10 modules total for Phase 1 (auth, storage, events, document, collab, permissions, sharing, convert, api, app)
- Redis added to Docker Compose stack alongside PostgreSQL and S3
- Every module gets a Zod-based contract before implementation
- Agent read-observe-write loop works through standard REST/SSE endpoints
- `worker_threads` required for CRDT compaction (from Decision #001)

## Deliberation Summary

Three models (Claude, Gemini, DeepSeek) over 6 rounds. Key debates:

- **editor-core vs document**: Converged on `document` as the snapshot type owner, not a TipTap wrapper
- **API module scope**: REST + SSE only; WebSocket upgrade delegated to collab
- **auth vs permissions vs sharing**: Three-way split — identity, ACL evaluation, and grant management are distinct concerns
- **i18n as a module**: Rejected — it's a cross-cutting build convention
- **session module**: Proposed then rejected — concerns covered by auth, collab (presence), and app
- **OCC vs intent transformation for agent writes**: OCC won — Yjs cannot reconstruct historical snapshots for replay
- **TOCTOU in permission checking**: Async revocation via events, not synchronous check in CRDT path
- **telemetry as kernel module**: Acknowledged as correct, deferred to avoid premature decomposition

## Required Follow-up Deliberations

1. Intent routing and acknowledgement under multi-node collab (Redis channel RPC)
2. Agent integration contract surface (exact HTTP API spec for the full agent loop)
3. Permissions-to-collab revocation event contract
