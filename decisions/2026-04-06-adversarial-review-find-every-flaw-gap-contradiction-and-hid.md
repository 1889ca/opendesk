# Decision: Adversarial Architecture Review — Phase 1

**Date**: 2026-04-06
**Status**: Accepted (with required amendments to Decisions #001 and #002)
**Deliberation**: 2026-04-06-adversarial-review-find-every-flaw-gap-contradiction-and-hid-deliberation.md

## Context

Before writing contracts, we stress-tested the Phase 1 architecture by asking three models to be hostile reviewers. The goal was to find contradictions, hidden assumptions, and failure modes before pouring concrete.

## Findings: Categorized by Severity

### MUST FIX before contracts (architecture-breaking)

1. **Events: PG NOTIFY 8KB limit is a hard wall.** State vectors grow with contributors. Once payload exceeds 8KB, `pg_notify` errors and rolls back the entire transaction — silently killing the event pipeline for that document. **Fix: Events must NEVER include state vectors or payloads. Thin events only (aggregateId + revisionId). State vectors transmitted out-of-band via Redis or direct fetch.**

2. **Events: Redis pub/sub is at-most-once.** The architecture assumes reliable delivery for permission revocation, export triggers, and agent observation. Redis pub/sub drops events if subscribers are down. **Fix: Replace Redis pub/sub with Redis Streams for event delivery. Streams provide consumer groups, acknowledgement, and replay — at-least-once semantics. Keep Redis pub/sub only for ephemeral presence/awareness.**

3. **Agent intent routing has no path in multi-node.** REST intents arrive at stateless `api` with no way to reach the correct Hocuspocus node holding the in-memory Y.Doc. **Fix: Use per-document Redis channel for intent routing (from Decision #002's Gemini proposal). Document-owning node listens on `document:{id}:intents`. Dormant documents get a short-lived collab instance spun up on the receiving node.**

4. **IntentExecutor cannot use JSON paths for CRDT targeting.** Array indices shift under concurrent edits. JSON paths are meaningless against a linked-list CRDT. **Fix: Use Yjs `relativePosition` API for anchor-based targeting. Agents reference block IDs (stable identifiers assigned at creation), not positional indices. The contract must specify block-ID-based intent schemas, not path-based.**

5. **Dual-clock OCC is incoherent.** `currentRevision` (snapshot counter) and `stateVector` (Yjs clock) advance independently. Agents can't reason about two inconsistent clocks. **Fix: OCC uses a single `revisionId` derived from the Yjs state vector hash. Drop the separate snapshot counter. One clock, one truth.**

### MUST ACKNOWLEDGE in contracts (real but manageable)

6. **Permission revocation leaves operations in the CRDT DAG.** Yjs is append-only; there's no clean rollback. **Acknowledgement: Document this as a known limitation. The ~200-500ms TOCTOU window means a revoked user's final keystrokes persist. For MVP, this is acceptable — similar to how Google Docs handles mid-revocation edits. For sensitive deployments, implement periodic document audit that flags post-revocation operations for human review.**

7. **Server-side Zod validation of Yjs updates is impractical per-keystroke.** Binary CRDT updates can't be cheaply validated against a schema. **Acknowledgement: Validation happens at two points: (a) Intent submission (Zod validates the intent JSON before translation), (b) Periodic materialization (Zod validates the snapshot during flush). Not per-keystroke. Malformed CRDT updates from malicious WebSocket clients are mitigated by TipTap's schema enforcement on the client side + periodic server-side materialization checks.**

8. **LibreOffice will OOM a shared Docker Compose host.** It's a memory-hungry C++ monolith. **Fix: Convert service gets explicit cgroup memory limits in Docker Compose, runs with `--oom-score-adj` to be killed first. Document that production deployments should run convert on a separate host.**

9. **200-line contract.ts limit won't hold for `collab`.** Seven behavioral subsystems in one module. **Fix: Allow `contract/` directory with multiple contract files (e.g., `contract/occ.ts`, `contract/materializer.ts`). The 200-line limit applies per-file, not per-module. The module-level `contract.ts` re-exports all sub-contracts.**

### ACKNOWLEDGED as real risks, deferred past MVP

10. **AGPL + AI-generated code copyright uncertainty.** No settled case law on whether AI-generated code attracts copyright. The CLA may be legally fragile for agent-authored contributions. **Mitigation: Human maintainers review and substantially edit agent PRs for restricted zones. Track this as an ongoing legal risk. Get actual legal counsel before commercial licensing.**

11. **SSE connection exhaustion at scale.** 1000 agents x 1000 documents = too many connections. **Mitigation: Sufficient for MVP scale (tens of agents, hundreds of documents). Webhook delivery or multiplexed subscription endpoint for Phase 2.**

12. **Constitution creates human bottleneck for restricted zones.** Agents can't detect restricted zone intersection before implementing. **Mitigation: Add machine-readable restricted zone annotations to contracts. Agents check before implementing. But for MVP, human review latency is acceptable given the small team.**

13. **Docker Compose vs multi-node is architecturally incoherent.** **Resolution: MVP runs single-node Hocuspocus. Redis is included in Compose for the event stream (Redis Streams) and intent routing, but multi-node collab scaling is explicitly Phase 2. Remove "Redis leader election" language from the architecture — it's premature.**

### REJECTED (overblown or incorrect)

14. **"AGPL Corresponding Source requires prompt history"** — Novel legal theory with no case law. The TypeScript IS the source code. Prompts are tools used to generate it, like an IDE or compiler. The AGPL requires source code, not the development environment.

15. **"Agent rate limiting circumvented by WebSocket protocol downgrade"** — Valid observation, but agents authenticate with service account principals. WebSocket connections from agent principals can be rate-limited or blocked at the auth layer. The rate limit isn't just on the HTTP endpoint.

16. **"The 10-module decomposition is agent-hostile"** — Overstated. Cross-module tasks are exactly what contracts-first solves. The contracts define the interfaces; agents implement against them. This is how microservice teams work with human developers too.

## Amendments to Prior Decisions

### Decision #001 amendments:
- State vector co-persistence: store alongside snapshots but with explicit client expiry policy (clients offline > 30 days get entries pruned)
- Server-side validation: periodic materialization check, not per-keystroke

### Decision #002 amendments:
- Events module: Redis Streams (not pub/sub) for guaranteed delivery; PG outbox writes thin events only (never include state vectors)
- OCC: single `revisionId` (state vector hash), not dual-clock
- IntentExecutor: block-ID-based targeting via Yjs `relativePosition`, not JSON paths
- Contract structure: `contract/` directory with per-file 200-line limit for complex modules
- MVP runs single-node Hocuspocus; multi-node scaling is Phase 2
- Convert service: explicit cgroup memory limits in Docker Compose
- Permissions: async revocation is acceptable; post-revocation operations documented as known limitation

## Required Follow-up Deliberations

1. IntentExecutor protocol specification (block-ID targeting, relativePosition API, retry semantics)
2. Event pipeline end-to-end contract (Redis Streams consumer groups, SSE replay, delivery guarantees)
3. Legal review scope for AGPL + AI-authored code (not a hivemind topic — needs actual lawyers)
