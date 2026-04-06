# AI Deliberation: Research: What should OpenDesk's Phase 1 module architecture and boundaries be?

*Started: 2026-04-06T20:46:59.688Z*

## System Prompt

You are participating in a focused research session.

**Research Topic**: What should OpenDesk's Phase 1 module architecture and boundaries be?

**Context/Background**: OpenDesk is a sovereign open-source office suite (AGPL-3.0). Phase 1 MVP is a collaborative document editor. Stack: TipTap + Yjs + Hocuspocus, Node.js backend, PostgreSQL + S3 storage, OIDC auth, Docker Compose deployment, bilingual EN/FR. Decision #001 confirmed Yjs as the CRDT layer. Key architectural principles: 1) Highly modular - lego blocks that compose together for complex business logic. 2) Highly extensible - modules should be easy to extend without modifying core. 3) Agentic connectivity - unspecified but the architecture should anticipate future AI agent integration (agents reading/writing documents, triggering workflows, participating as collaborators). 4) No files over 200 lines, no god files, single responsibility per module. 5) Helper methods for store, sockets, HTTP, outside APIs - never direct implementations. 6) Contracts-first - every module gets a behavioral contract before implementation. Initial module candidates: editor-core (TipTap/ProseMirror schema), collaboration (Yjs/Hocuspocus/awareness), conversion (LibreOffice microservice), auth (OIDC/OAuth2), storage (PostgreSQL + S3 hot/cold), api (REST + WebSocket), sharing (permissions/links), i18n (EN/FR), app (frontend shell/UI). Questions to resolve: Are these the right boundaries? Should any be merged or split? What's the dependency graph? How do we structure for extensibility without premature abstraction? How should we anticipate agentic integration without over-engineering for it? What module interaction patterns (events, direct imports, message bus) best serve both human and agent contributors?

**Your Role**:
- Propose concrete mechanisms, not vague hand-waving
- Build on others' ideas - refine and extend their reasoning
- Challenge explanations if you see a better path
- Be specific about trade-offs and limitations
- Flag when something is speculative vs well-established

**Guidelines**:
1. Focus on technical depth over breadth
2. Identify the hardest unsolved sub-problems
3. Propose testable hypotheses where possible
4. Be concise but thorough

---

# Conversation


> **Moderator**: The central question before us is whether the proposed module candidates for OpenDesk's Phase 1 reflect natural seams in the system — boundaries where cohesion is high, coupling is low, and future extension remains uninvasive — or whether some boundaries are drawn too coarsely, too finely, or in the wrong place entirely. Three sub-questions sharpen the inquiry: first, which modules represent genuinely independent concerns versus coupled concerns that only *appear* separable; second, what interaction patterns — direct imports, event buses, or explicit contracts — best serve a system that must serve both human collaborators and future autonomous agents without privileging either prematurely; and third, where does the line fall between anticipating agentic integration thoughtfully and over-engineering for a use case that remains underspecified. We'll approach this analytically, treating each proposed boundary as a hypothesis to stress-test rather than a given to rationalize.


## Claude (2026-04-06T20:48:41.601Z)

## Challenging the Proposed Boundaries

### The `editor-core` / `collaboration` Split Is a Useful Fiction

These *look* separable but the TipTap-Yjs binding (`@tiptap/extension-collaboration`) is not optional wiring — it replaces ProseMirror's own transaction history with Yjs's UndoManager and makes Y.XmlFragment the authoritative state. You cannot run editor-core "without" collaboration and get the same document model. The apparent seam is actually a binding site.

The fix isn't merging them — it's defining the seam correctly. `editor-core` should own exactly one thing: the **`DocumentSnapshot` type** — a serializable, schema-versioned ProseMirror JSON representation that is the *lingua franca* of the entire system. `collaboration` then owns everything that inflates/deflates between Yjs binary and `DocumentSnapshot`. This makes the boundary testable: you can unit-test schema, serialization, and commands against `DocumentSnapshot` without Yjs in scope.

This also immediately solves the agent-read problem: an agent that wants to read a document without joining a WebSocket session asks for a `DocumentSnapshot` via REST. No special agent surface needed.

### The `api` Module Is Architecturally Incoherent

"REST + WebSocket" in one module sounds unified but obscures a real difference: the WebSocket server *is* Hocuspocus, and Hocuspocus *is* the collaboration module. If `api` owns WebSocket, it becomes a thin proxy for `collaboration` — which means either `api` imports `collaboration` deeply, or you're duplicating state management. Neither is good.

Cleaner model: `api` owns REST only. The Hocuspocus WebSocket server lives in `collaboration` and is mounted into the same Node.js HTTP server via upgrade handler. The `api` module gets a reference to the server at startup and delegates `ws://` upgrades. This keeps `api` ignorant of Yjs.

### `sharing` and `auth` Are Entangled — in a Specific, Fixable Way

The problem: "can user X perform action Y on document Z?" requires knowing both identity (auth's domain) and access grants (sharing's domain). Wherever you put this evaluation, you create a dependency arrow pointing the wrong way.

**Proposed resolution**: extract a `permissions` kernel module that owns the ACL data model and evaluation logic, with zero dependency on the application layer. `auth` resolves identity and emits a principal. `sharing` writes to the permissions store (creating grants). `permissions` evaluates queries. This is the classic policy/enforcement separation and it scales cleanly to agents (agent service accounts get principals too, evaluated by the same ACL).

### `i18n` Is Not a Module — Stop Treating It Like One

It's a cross-cutting utility. Calling it a module with boundaries implies it has an interface other modules call through, which in practice means `t('key')` calls scattered everywhere. The architectural decision here isn't *how to structure the i18n module* — it's *where translation keys live* (co-located with their UI component, not centralized). Promote it to a build-time convention, not a runtime module.

### The Dependency Graph (Concrete Proposal)

```
Kernel (no domain dependencies):
  auth      ← identity, OIDC tokens, principal resolution
  storage   ← abstract read/write/delete; tiering is internal
  events    ← typed event bus (THIS is a kernel module, not an afterthought)

Document Domain:
  document  ← DocumentSnapshot type + schema (replaces "editor-core")
  collab    ← Yjs/Hocuspocus; imports document, emits events
  convert   ← async format transform; imports document, fully isolated

Access Domain:
  permissions ← ACL model + evaluation; imports auth + storage
  sharing     ← grant management + link generation; imports permissions

Application:
  api   ← REST only; imports all domain modules; mounts collab's WS
  app   ← frontend shell; composes TipTap + Yjs + awareness UI
```

Dependency direction: strictly downward. No cycles. Each layer testable in isolation against the layer below.

### The Agentic Question Has a Precise Answer

The dangerous instinct is to add agent-specific surface area now. The correct instinct is to observe that agents need three things: **authentication** (service account → principal, handled by `auth`), **document access** (REST `DocumentSnapshot` endpoint, handled by `api`), and **change observation** (the typed event bus, handled by `events`).

All three of these are already required for humans. The only Phase 1 commitment that specifically *anticipates* agents without over-engineering is: **make `events` a first-class kernel module with typed payloads, not an ad-hoc `emit('string')` pattern**. A `DocumentUpdated { docId, actorId, actorType: 'human' | 'agent' | 'system', snapshot }` event costs you nothing to define now and gives you an observation hook that agents can subscribe to without any module needing to know they exist.

The `actorType` field is the one concrete concession to agentic futures. Everything else falls out of good hygiene.

### The Hardest Unsolved Sub-Problem

**Snapshot consistency under concurrent writes.** When a Yjs session has 3 active clients and your REST API serves a `DocumentSnapshot`, you need to decide: snapshot from the last persisted state (stale), or request a flush from the Hocuspocus server's in-memory Y.Doc (adds latency + coupling). This is not a module boundary question — it's a data consistency contract that must be made explicit before any implementation starts. The `collab` module needs to define what "current document state" means when clients are connected, and `api` needs to make a documented choice about which consistency level it promises. This decision affects `conversion`, agent reads, and search indexing simultaneously.

---

## Gemini (2026-04-06T20:49:12.933Z)

Claude’s architectural realignment of the `document`, `collab`, and `permissions` boundaries is highly pragmatic, but it leaves critical gaps in how this system scales horizontally and how agents can actually *mutate* state, not just observe it. 

I will build on Claude's foundation, challenge the implicit assumptions of the `events` bus, propose a concrete solution to the "Snapshot Consistency" problem, and define the missing mechanism for Agent Writes.

### 1. The `events` Module Flaw: Ephemerality vs. Scale
Claude rightly promotes `events` to a kernel module, but an in-memory event bus (like Node’s `EventEmitter`) is a trap in a Docker Compose environment where `api` and `collab` (Hocuspocus) might scale to multiple replicas. If an agent connects to `api-replica-1` and a human is connected to `collab-replica-2`, an in-memory bus silently drops the interaction.

**Concrete Mechanism:** The `events` module must be defined purely by its contract (following the *Contracts-First* mandate) as a **Distributed Pub/Sub**. Given the stack already includes PostgreSQL, the concrete implementation behind the `events` contract should utilize PostgreSQL `LISTEN/NOTIFY` (or Redis, if added to the stack) as the backplane. 
Furthermore, to support agents reliably, this module must implement the **Transactional Outbox Pattern** for critical domain events (`DocumentUpdated`, `GrantCreated`). This guarantees that if an agent is subscribing via webhooks, it doesn't lose events if the Node process crashes mid-tick.

### 2. Solving the "Snapshot Consistency" Problem via CQRS
Claude identified the friction between the Hocuspocus in-memory `Y.Doc` and the REST `DocumentSnapshot` but didn't resolve it. The solution is explicitly decoupling read models from write models (CQRS-lite).

**Concrete Mechanism:** 
1. `collab` owns the Yjs binary. It is the absolute source of truth.
2. We introduce a background materialization cycle within `collab`: on a debounced timer after a client disconnects or after $N$ operations, `collab` flushes the binary to `storage` AND fires a `StateFlushed` event.
3. A stateless materializer (living in the `document` module) listens to this event, reads the binary, inflates it to the `DocumentSnapshot` JSON, and saves that back to `storage` (e.g., S3).

**The Trade-off:** REST API (`api`) reads are strictly **eventually consistent**. `GET /api/documents/:id` returns the last materialized `DocumentSnapshot` + a `stateVector` header. If an agent or downstream service requires the absolute latest state, they must pass `?sync=true`, which triggers a synchronous RPC call over the `events` bus to the `collab` node holding the active `Y.Doc` to flush immediately. This cleanly explicitly trades baseline latency for guaranteed consistency only when requested.

### 3. The Missing Agentic Boundary: The `Command` Interface
Claude solved Agent *Reads* (REST `DocumentSnapshot`) and Agent *Observation* (`events`), but missed Agent *Writes*. You cannot ask an LLM or an external system to reliably generate ProseMirror step JSON or Yjs binary diffs. 

**Concrete Mechanism:** We must introduce an **Intent Translation Boundary** within the `document` module. 
Instead of exposing Yjs structures to the `api`, the `api` module exposes a semantic command endpoint: `POST /api/documents/:id/intents`.
Agents send deterministic, human-readable payloads:
`{ "action": "insert_block", "anchor": "block-id-123", "content": "..." }`

The `collab` module consumes these intents, spins up a headless Yjs client internally, translates the semantic intent into Yjs operations, and broadcasts them to connected WebSocket clients. This ensures the complex CRDT resolution logic is completely hidden behind the module boundary. 

### 4. Structural Enforcement of "No Files > 200 Lines"
To enforce the "Highly Extensible" and "No Files > 200 Lines" constraints alongside the "Contracts-First" methodology, the directory structure must be weaponized as an architectural boundary.

```text
modules/
  collab/
    contract.ts       <-- MAXIMUM 200 lines: ONLY TypeScript Interfaces/Types (The "What")
    index.ts          <-- The export barrier. Nothing is exported unless it's here.
    internal/         <-- The implementations (The "How"). 
      hocuspocus.ts
      materializer.ts
```
If `contract.ts` exceeds 200 lines, the module is objectively doing too much and must be split. This provides a hard, lintable metric for boundary cohesion. External modules (like `api`) may *only* import `contract.ts` for typings and `index.ts` for instantiation. 

### Summary Dependency Refinement
Building on Claude's graph:
*   **Kernel:** `auth`, `storage`, `events` (Backed by PG/Redis + Outbox).
*   **Document:** `document` (Snapshot + **Intent Schema**), `collab` (**Materializer** + Hocuspocus).
*   **Access:** `permissions`, `sharing`.
*   **Application:** `api` (Consumes intents, reads materialized snapshots), `app`.

---

## DeepSeek (2026-04-06T20:50:22.768Z)

## Building on Foundations, Addressing Gaps

### 1. The "Client/Server Split" Problem in `collab`

The proposed `collab-client`/`collab-server` split creates a dangerous abstraction: it suggests the collaboration module spans both contexts when it fundamentally does not. The actual boundary is **protocol**, not function. 

**Concrete correction**: `collab` is exclusively a **server-side module** that:
- Hosts the Hocuspocus WebSocket server
- Manages Y.js document persistence
- Implements the materialization cycle
- Exposes a server-side Y.js client for agent intent translation

The frontend integration (`TipTap + Y.js + Awareness`) belongs in the `app` module as a **binding**, not a module. This is crucial because:
- The frontend binding is a thin adapter (already exists as `@tiptap/extension-collaboration`)
- It has zero business logic - only connection management and UI state
- Calling it a "module" invites over-engineering what should be wiring

**Testable hypothesis**: If the `collab` module exports any browser-compatible code, the boundary is wrong.

### 2. The Storage Abstraction Is Backwards

The proposed `storage` abstract interface with S3/PostgreSQL implementations violates principle #5: "Helper methods for outside APIs - never direct implementations." We're abstracting the wrong thing.

**Correct approach**: 
- `storage` module owns **only** the data lifecycle policy (hot/cold, retention, backup)
- It delegates to `s3-adapter` and `postgres-adapter` modules that wrap the external APIs
- These adapters implement retries, error handling, and monitoring specific to each service

This aligns with the hexagonal architecture pattern: the core defines what it needs, adapters implement how.

```typescript
// storage/contract.ts
interface DocumentRepository {
  saveSnapshot(snapshot: DocumentSnapshot): Promise<void>;
  getSnapshot(docId: string): Promise<DocumentSnapshot | null>;
}

// storage/postgres-adapter/contract.ts  
interface PostgresDocumentStore extends DocumentRepository {
  // PostgreSQL-specific operations
  findRecent(limit: number): Promise<DocumentSnapshot[]>;
}
```

Now you can test `storage` logic with a mock `DocumentRepository`, and swap S3 for MinIO without touching business logic.

### 3. Agent Writes: The Intent Translation Boundary Is Incomplete

Gemini's `Command` interface is correct but mislocated. If `collab` owns intent translation, it now depends on understanding the semantic intent schema - which is a **document domain concern**, not a collaboration concern.

**Precise boundary**: 
- `document` module defines the `DocumentIntent` type and validation
- `collab` module provides a `IntentExecutor` that takes validated intents and applies them via Y.js
- `api` module validates incoming intents against the `document` schema before passing to `collab`

This keeps `collab` focused on CRDT mechanics while `document` owns the semantic model.

### 4. The Missing Module: `session`

Both Claude and Gemini missed a critical concern: **user session state**. When a user has multiple documents open across tabs, we need:
- Tab/window coordination (avoid duplicate connections)
- Offline draft persistence
- Presence synchronization across devices

This isn't `auth` (identity) or `collab` (document synchronization). It's a distinct concern that becomes critical for agentic integration: agents need session-like context too.

**Concrete proposal**: Add `session` module to the kernel that:
- Manages ephemeral user/agent state
- Provides cross-tab coordination via BroadcastChannel (browser) or Redis (server)
- Emits `SessionActivity` events for observability

### 5. The Dependency Graph Needs Temporal Constraints

Static dependencies aren't enough. We need to specify **initialization order** and **failure tolerance**:

```
Kernel (must initialize first, tolerate failures):
  auth → storage → events → session

Document Domain (can start partially):
  document → collab (depends on events, storage)
  
Access Domain (optional for MVP):
  permissions → sharing (depends on auth, storage)

Application (depends on everything):
  api → (mounts collab WS, depends on all above)
  app → (imports document types, depends on api)
```

**Critical insight**: `collab` should function in degraded mode if `convert` is unavailable. This requires the `convert` module to be truly optional at runtime, not just in deployment.

### 6. The Hardest Problem: Idempotent Agent Operations

No one has addressed how agents handle failures during document mutation. If an agent sends an intent but crashes before acknowledgement, what happens on retry?

**Concrete mechanism**: Every `DocumentIntent` must include:
```typescript
interface DocumentIntent {
  id: string; // UUIDv4 generated by agent
  idempotencyKey: string; // Hash of intent content
  timestamp: ISOString;
  // ... payload
}
```

The `collab` module maintains an idempotency key cache (TTL 24h) and rejects duplicates. This is **not** over-engineering - it's required for any reliable agent integration, and benefits human users too (prevent duplicate edits from flaky networks).

### 7. Event Schema Is a Contract, Not an Implementation Detail

Both Claude and Gemini treat events as implementation details. They're not - they're **public API** once agents can subscribe. The `events` module must publish a machine-readable schema (JSON Schema or TypeScript types) that agents can use to validate events.

This schema becomes part of the module's 200-line contract file, enforced by CI.

## Revised Module List with Clear Boundaries

1. **Kernel** (no business logic):
   - `auth` - identity, principals
   - `storage` - lifecycle policies only
   - `events` - typed pub/sub with schema
   - `session` - ephemeral state management

2. **Adapters** (wrappers for external services):
   - `s3-adapter` - implements storage interface
   - `postgres-adapter` - implements storage + events
   - `oidc-adapter` - implements auth interface

3. **Document Domain**:
   - `document` - schema, snapshot type, intent definition
   - `collab` - Y.js/Hocuspocus, materializer, intent executor

4. **Access Domain** (Phase 2):
   - `permissions` - ACL model
   - `sharing` - grant management

5. **Services** (can fail independently):
   - `convert` - standalone microservice
   - `api` - REST only, mounts collab WS

6. **Frontend**:
   - `app` - UI shell + TipTap/Y.js binding

The key advancement: recognizing that **adapters are modules too**, and that **session management** is a first-class concern for both humans and agents. This architecture supports agentic integration through existing mechanisms (auth principals, event subscriptions, idempotent intents) without special casing.

---

## Mistral (2026-04-06T20:50:23.009Z)

[No response - authentication error]

---

## Claude (2026-04-06T20:51:46.779Z)

## Advancing the Conversation: Three Gaps and a Stress Test

### Challenge: The `session` Module Is a Category Error

DeepSeek's `session` module conflates three unrelated concerns: browser tab coordination (BroadcastChannel — frontend binding, not a module), server-side presence (already owned by Hocuspocus awareness in `collab`), and agent session context (a principal + a set of capabilities, already handled by `auth`). The reason these feel like one module is that they all touch "who is currently active," but their implementations share zero code and have zero common abstractions. Introducing a `session` module creates a false attractor that will absorb unrelated code over time. Drop it. The actual gap it's pointing at is: **Hocuspocus awareness state isn't currently observable outside the WebSocket session** — but the fix is a `collab`-emitted `PresenceChanged` event, not a new module.

---

### Gap 1: `DocumentSnapshot` Schema Evolution Is Unaddressed — and It's a Day-One Decision

If `DocumentSnapshot` is the lingua franca of the entire system (Claude's framing, which I accept), then schema migration isn't a future concern — it's a constraint that must be embedded in the type definition from commit one. Every snapshot stored in S3 will carry the schema version of the ProseMirror spec that produced it. When you add a `callout` node type in month three, you now have two populations of documents.

**Concrete mechanism**: The `document` module must own a `SchemaVersion` enum and a migration registry:

```typescript
// document/contract.ts
interface DocumentSnapshot {
  schemaVersion: SchemaVersion;
  content: ProseMirrorJSON;
  // ...
}

// document/migrations/contract.ts
interface Migration {
  from: SchemaVersion;
  to: SchemaVersion;
  up(snapshot: DocumentSnapshot): DocumentSnapshot;
}
```

The materializer (in `collab`, consuming `StateFlushed` events) must pass the raw snapshot through the migration chain before writing to storage. Any reader — REST API, agent, conversion service — receives a snapshot at `SchemaVersion.current` regardless of when the document was last actively edited.

This is non-negotiable before any snapshot is persisted. The cost of retrofitting this after 10,000 documents are stored is migration scripts with no rollback path.

---

### Gap 2: PG `NOTIFY` Has an 8KB Payload Limit — Gemini's `events` Implementation Will Silently Fail

PostgreSQL `LISTEN/NOTIFY` payloads are capped at 8,000 bytes. A `DocumentUpdated` event carrying a `DocumentSnapshot` for even a modest document will exceed this. If the `events` module uses fat events (payload in the notification itself), it will silently drop or truncate. This is the kind of failure that doesn't surface in development with short documents but corrupts data in production.

**Correct pattern**: Thin events with a correlation ID, not fat events.

```typescript
// events/contract.ts
interface DomainEvent {
  id: string;           // UUIDv4
  type: EventType;
  aggregateId: string;  // docId, userId, etc.
  actorId: string;
  actorType: 'human' | 'agent' | 'system';
  occurredAt: ISOString;
  // NO payload — subscribers fetch payload from storage using aggregateId
}
```

`DocumentUpdated` notifies subscribers that document `docId` changed. Subscribers who need the new snapshot call `storage.getSnapshot(docId)`. The transactional outbox Gemini described remains correct — but what's written to the outbox is the thin event, and the snapshot is already durably stored independently. This separates the guaranteed-delivery concern (thin event) from the data-availability concern (snapshot in storage).

---

### Gap 3: Agent Write Acknowledgement Model Is Unresolved — and It Determines Usability

Gemini and DeepSeek defined intent structure and location correctly. Neither addressed what happens after `POST /api/documents/:id/intents` returns. Two options with very different implications:

**Option A — Fire-and-forget (202 Accepted)**: Agent receives an intent ID, polls for a `DocumentIntentApplied` or `DocumentIntentRejected` event. Simple to implement, but forces every agent workflow to carry polling logic. Multi-step agent operations (insert block, then update that block's content) are impossible to sequence reliably.

**Option B — Synchronous acknowledgement with state vector**: `collab`'s `IntentExecutor` applies the intent to the Y.Doc and returns the new Yjs state vector in the response body. The agent can verify its intent was applied and compose the next operation with causal ordering. Requires the HTTP request to reach the node that holds the active Y.Doc.

Option B is strictly more useful for agents, but it surfaces the **document-to-node routing problem** that Gemini's `?sync=true` also implies: in a multi-replica deployment, you need to route intent requests to the node currently hosting that document's Y.Doc. The naive solution is sticky sessions (problematic under failure). The correct solution is a lightweight document-owner registry in the `events` kernel (a single row in PG per active document: `{docId, nodeId, acquiredAt}`), with a TTL and heartbeat. This registry is small, changes infrequently, and naturally handles node failure through TTL expiry.

This registry is worth naming explicitly: `collab/internal/document-registry.ts`. It's internal to `collab`, but its existence has implications for how `api` routes intent requests.

---

### The Extensibility Stress Test: What Happens When Document Type 2 Arrives?

The current architecture's extensibility claim needs a concrete adversarial test. Suppose Phase 3 adds a spreadsheet editor (TipTap doesn't apply; probably a different CRDT structure for cell-based documents).

Under the current proposal:
- `DocumentSnapshot` is defined as ProseMirror JSON + a schema version. Spreadsheet state is not ProseMirror JSON.
- `collab` materializes by inflating Yjs binary → ProseMirror JSON. That inflation is document-type-specific.
- `convert` likely uses LibreOffice, which handles both formats — but the conversion input/output types currently assume ProseMirror.

The failure mode: "document" becomes secretly "text-document," and adding spreadsheets requires either forking the `document` module or introducing `type` discriminants everywhere.

**The fix that doesn't require over-engineering now**: `DocumentSnapshot` needs a `documentType: string` discriminant field from day one, and `SchemaVersion` should be namespaced to the document type. The ProseMirror-specific fields should be under a typed union:

```typescript
type DocumentSnapshot = TextDocumentSnapshot | SpreadsheetSnapshot; // Phase 3+
type TextDocumentSnapshot = { documentType: 'text'; schemaVersion: TextSchemaVersion; content: ProseMirrorJSON; }
```

In Phase 1, the union has exactly one member. The cost is near-zero. The benefit is that `convert`, `collab`, and `api` all branch on `documentType` explicitly rather than assuming, which makes the seam visible when the second type arrives.

---

### Revised Kernel Addition

The document-owner registry belongs in the dependency graph:

```
Kernel:
  auth, storage, events (thin, PG-backed + outbox)
  
Document Domain:
  document  ← Snapshot type (discriminated union) + SchemaVersion + migration registry + Intent schema
  collab    ← Hocuspocus + materializer + IntentExecutor + document-owner registry
  
(Everything else per prior proposals, with `session` dropped)
```

The hardest remaining open question, which nobody has fully resolved: **who owns conflict detection for idempotent intents when two agents submit semantically-overlapping intents concurrently?** DeepSeek's idempotency key handles exact duplicates. It doesn't handle "agent A inserts a paragraph at block-3, agent B deletes block-3, both submitted within the same Yjs sync window." Yjs will resolve this at the CRDT level — but the *intent acknowledgement* to both agents will claim success even though one agent's semantic intent was effectively negated. This is the CRDT semantic gap, and it has no clean solution at the module boundary level — but it should be documented as a known limitation in `collab/contract.ts` before any agent integration goes live.

---

## Gemini (2026-04-06T20:52:25.784Z)

## Eliminating the Registry, Fixing the Race Condition, and Closing the Semantic Gap

Claude rightly exposes the 8KB PostgreSQL limit and the severe UX implications of asynchronous agent writes. However, the proposed `document-owner registry` in PG is a distributed systems anti-pattern for this stack, and the "Thin Events" model introduces a fatal race condition.

Here are the concrete mechanisms to resolve these, along with a solution to Claude’s final unsolved problem: the CRDT semantic gap for agents.

### 1. Reject the PG Registry: Leverage the Hocuspocus Redis Backplane
**The Flaw:** Building a bespoke PG-backed TTL registry to route REST intents to the correct `collab` node is brittle. It suffers from split-brain during network partitions and requires constant heartbeat overhead. Furthermore, if `collab` scales to multiple nodes, Hocuspocus *already requires* Redis to synchronize `Y.Doc` updates across replicas (via `@hocuspocus/extension-redis`).

**The Fix (Choreography over Orchestration):** 
Do not track which node owns the document. When the `api` module receives `POST /api/documents/:id/intents`, it does not look up a node. Instead, it publishes a targeted RPC payload to a Redis channel dedicated to that document: `document:{id}:intents`. 
1. If the document is active in memory, exactly one `collab` node has claimed leadership for that Y.Doc. That node listens to the channel, translates the intent, applies it, and responds on a reply channel.
2. If the document is dormant (no active WebSockets), no node responds within 50ms. The `api` module acts as a fallback, spinning up a short-lived `collab` internal materializer to apply the intent directly against the persisted `storage` binary, saving it without ever mounting a WebSocket server.
*Trade-off:* We introduce Redis as a hard dependency, but eliminate a massive class of state-coordination bugs.

### 2. Fixing the "Thin Events" Race Condition
**The Flaw:** If `events` emits a thin `DocumentUpdated` event (containing only `docId`) and an agent immediately calls `GET /api/documents/:id`, the materializer in `collab` likely hasn't finished uploading the new `DocumentSnapshot` to S3. The agent reads stale data, acts on it, and creates cascading logical errors.

**The Fix (Causal Consistency via Headers):** 
The thin event must include a `revisionId` (a fast hash of the Y.Doc state vector).
```typescript
interface DomainEvent {
  aggregateId: string;
  revisionId: string; // The exact state this event represents
  // ...
}
```
When the agent responds to the event by requesting the snapshot, it passes this revision:
`GET /api/documents/:id` with header `If-Match: "{revisionId}"`

If the `api` module fetches the snapshot from `storage` and its `revisionId` is older than the header, the `api` module *blocks* (up to a timeout) and uses the Redis backplane to request a synchronous flush from the active `collab` node. This guarantees read-after-write consistency for agents without forcing humans to pay the latency cost of synchronous materialization.

### 3. Closing the CRDT Semantic Gap: Optimistic Concurrency Control (OCC) for Intents
Claude asked: *How do we handle Agent A inserting at Block 3, while Agent B deletes Block 3?* Yjs will happily merge both, but the semantic intent of Agent A is destroyed. 

**The Fix:** We cannot solve this inside the CRDT, so we must solve it at the Intent Boundary. We force agents to declare the state of the world they based their decision on.

Every `DocumentIntent` must include a `baseRevision`.
```typescript
interface DocumentIntent {
  idempotencyKey: string;
  baseRevision: string; // The revisionId the agent read before deciding to act
  action: "insert_block" | "update_block";
  targetBlockId: string;
}
```
When `collab`'s `IntentExecutor` receives this intent, it compares `baseRevision` against the current Y.Doc state. If the specific `targetBlockId` has been modified by a human or another agent *after* the `baseRevision`, the `IntentExecutor` **rejects the intent entirely** with a `409 Conflict`. 

*Why this works:* It forces LLMs/agents to operate like humans—if the paragraph you were about to edit disappears before you hit save, your action fails, and you must re-read the document to formulate a new plan. This entirely prevents semantic corruption without fighting the Yjs algorithm.

### 4. Weaponizing the 200-Line Contract: Runtime vs. Compile Time
Gemini proposed `contract.ts` as a hard 200-line limit for TypeScript interfaces. But TS types compile away. If an external agent sends a malformed `DocumentIntent`, and `api` passes it to `collab`, the Node process crashes.

**The Fix:** The 200-line `contract.ts` must be written entirely in **Zod** (or TypeBox), with TypeScript types inferred from the schemas.
```typescript
// document/contract.ts
export const DocumentIntentSchema = z.object({ ... });
export type DocumentIntent = z.infer<typeof DocumentIntentSchema>;
```
This fulfills the "Contracts-First" methodology at *both* compile time and runtime. The `api` module uses `document.DocumentIntentSchema.parse()` at the HTTP boundary. `collab` assumes pristine data. 

### Final Dependency Graph Refinement
*   **Kernel:** `auth`, `storage` (adapters inside), `events` (PG-outbox for durability, Redis for ephemeral pub/sub).
*   **Document:** `document` (Zod Schemas, Migration Registry).
*   **Collab:** `collab` (Server-only. Leader election via Redis. Rejects stale intents via OCC).
*   **API:** `api` (Choreographs intent routing, enforces causal reads via headers).

---

## DeepSeek (2026-04-06T20:53:25.114Z)

## Critical Corrections and Synthesis

### 1. Redis is Already Required - Stop Pretending Otherwise

Gemini's Redis argument is correct but understated. Hocuspocus **requires** Redis for multi-node deployment (`@hocuspocus/extension-redis`). This isn't optional architecture - it's a stack constraint. The document routing problem disappears when we acknowledge this: the Hocuspocus Redis extension already implements document locking and node coordination.

**Concrete realization**: The `collab` module's contract must explicitly declare Redis as a dependency for production scaling. The "single-node vs multi-node" discussion is misleading - development can use an in-memory simulation, but the architecture must assume Redis for any collaborative editing.

### 2. The Materialization Race Condition Has a Simpler Fix

Gemini's causal consistency via headers is overcomplicated. The race exists because we're trying to serve reads from storage while writes go through Yjs. The fix is simpler:

**Read-your-writes consistency**: When a client (human or agent) writes via WebSocket or REST intent, they receive the new state vector in response. Subsequent reads from that same session should include this state vector. The `api` module can maintain a session-consistent read cache using the same Redis that Hocuspocus uses for coordination.

**Trade-off**: This gives agents read-your-writes without forcing global synchronous materialization. Humans get eventual consistency for reads from other sessions, which matches expectations.

### 3. OCC for Intents is Wrong - Embrace CRDT Semantics

Gemini's OCC rejection of intents based on `targetBlockId` changes fundamentally misunderstands CRDTs. If we reject concurrent edits, we're building a non-collaborative editor. The correct approach:

**Intent transformation, not rejection**: When `collab` receives an intent with `baseRevision`, it should:
1. Replay intent against the Y.js document at that revision
2. Capture the resulting Y.js operations
3. Transform those operations through the current document state
4. Apply the transformed operations

This preserves both semantic intent (as much as possible) and CRDT convergence. The hard truth: some semantic intent **will** be lost in concurrent editing - that's inherent to collaboration, not a bug.

### 4. The Missing Critical Module: `telemetry`

Every discussion ignores observability. For a system that anticipates autonomous agents, we need:
- Structured logging of all intents and their transformations
- Metrics on edit conflicts and resolution outcomes
- Agent activity auditing

This isn't optional - it's required for debugging agent behavior. The `telemetry` module should be in the kernel, providing instrumentation hooks that all modules use.

### 5. The Final Boundary Test: Offline Editing

None of the proposed architectures handle offline editing gracefully. If we claim "sovereign" and "collaborative," we need to consider:
- Y.js can work offline with local storage
- Intents need to queue when network is unavailable
- Conflict resolution when reconnecting

This stress test reveals that `collab` needs a client-side component after all - not for business logic, but for offline persistence and intent queuing. The boundary isn't server/client - it's **online/offline capability**.

## Revised Architecture with Hard Constraints

```
Kernel (must initialize first):
  telemetry  ← instrumentation, structured logging, agent audit trail
  auth       ← principals with agent/human discrimination
  storage    ← abstract repository (Redis for active, S3 for cold)
  events     ← thin events with Redis pub/sub, transactional outbox

Document Core:
  document   ← union snapshot type, Zod schemas, migration registry
  collab     ← Hocuspocus + Redis, intent transformer, offline queue client

Access (deferrable):
  permissions ← evaluated at intent submission, not at materialization

Integration:
  api        ← REST + WebSocket mount, session-consistent read cache
  app        ← TipTap binding + offline queue UI

Critical Constraints:
1. Redis is required for multi-node (Hocuspocus dependency)
2. All intents are transformable, not rejectable
3. Read-your-writes consistency per session, eventual otherwise
4. Offline capability built into collab client binding
5. Telemetry captures intent transformations for agent debugging
```

The hardest remaining problem: **How do we test intent transformation correctness?** We need a test suite that replays recorded editing sessions with mixed human/agent intents and verifies the final document matches human expectations. This isn't a module boundary issue - it's a verification challenge that cuts across `document`, `collab`, and `telemetry`.

---

## Mistral (2026-04-06T20:53:25.292Z)

[No response - authentication error]

---

## Claude (2026-04-06T20:55:02.197Z)

## Closing Open Debates, Exposing Two Missing Dependencies

### The OCC vs. Intent Transformation Debate Is Already Resolved — by Yjs

DeepSeek's "intent transformation" proposal is Operational Transformation implemented on top of a CRDT. This is technically unsound for a specific reason: **Yjs does not store reconstructible historical document snapshots**. It stores a causal operation DAG. You cannot "replay an intent against the Y.Doc at `baseRevision`" because there is no `Y.Doc@revision42` to replay against — only the current state and a state vector describing which operations are known. Rolling back to an arbitrary historical state requires inverse operations that Yjs does not expose, and that path leads to reimplementing OT, which is exactly the complexity Yjs was designed to eliminate.

Gemini's OCC is correct. The framing of "reject" sounds harsh but matches how every serious programmatic document API actually works: Google Docs API, Notion API, Confluence API all require a `revision` parameter on writes and return a conflict error if the base is stale. The agent must re-read and reformulate. This is not a limitation — it is the correct semantic contract for deterministic agent behavior. Document the CRDT semantic gap in `collab/contract.ts` as Claude proposed, ship OCC, move on.

One concrete refinement: the 409 response body should include the current `revisionId` and a diff-friendly `stateVector`, so the agent can compute what changed without a full re-fetch:

```typescript
// 409 Conflict response body
interface IntentConflict {
  code: 'STALE_REVISION';
  baseRevision: string;       // what the agent sent
  currentRevision: string;    // what the document is now
  currentStateVector: string; // base64 Yjs state vector — agent computes delta
}
```

---

### The Missing External Surface: Agent Event Subscription Belongs in `api`

The `events` module is internal TypeScript. Every agent integration scenario requires *external* event observation — an agent process (or a future AI service) cannot `import { events } from '../events'`. This surface is missing from every dependency graph proposed so far.

**Concrete mechanism**: `api` exposes `GET /api/events/stream` as Server-Sent Events (SSE) with an optional `?types[]=DocumentUpdated&types[]=GrantCreated` filter. The endpoint authenticates via bearer token (principal from `auth`) and streams thin `DomainEvent` objects.

Why SSE over webhooks for Phase 1:
- No callback URL registration, no webhook management infrastructure
- Agents connect and receive events; reconnect is handled by SSE's `Last-Event-ID` header replaying from the outbox
- Upgradeable to webhooks in Phase 2 without changing the event schema contract

The `events` module already has a transactional outbox (per Gemini). SSE replay from that outbox is straightforward. The agent workflow becomes: connect SSE stream → receive `DocumentUpdated{aggregateId, revisionId}` → `GET /api/documents/:id` with `If-Match: revisionId` header (Gemini's causal consistency fix) → formulate intent → `POST /api/documents/:id/intents`.

This is the complete agent read-observe-write loop, and it requires zero agent-specific infrastructure beyond what's already proposed. The only addition is the SSE endpoint in `api`.

**Dependency implication**: `api` consumes `events` directly (to subscribe and stream). Add this arrow to the graph explicitly.

---

### `convert` Has an Undeclared Dependency on `events`

Every proposed graph shows `convert` as "fully isolated" — a microservice that takes a file in, returns a converted file out. This is wrong under active editing.

The problem: `POST /api/documents/:id/export` is called while 3 clients are editing. Storage holds a snapshot that is N minutes stale. The exported DOCX silently omits recent edits. Worse: if the document was just created and never materialized, storage has *nothing*, and the export pipeline fails or returns an empty document.

`convert` needs a consistent snapshot before invoking LibreOffice. The only correct mechanism: `convert` emits a `ConversionRequested{docId}` event, `collab` listens, performs a synchronous flush (using the Redis channel Gemini described), emits `StateFlushed{docId, revisionId}`, and `convert` proceeds once the snapshot is available in storage.

This means `convert` has a dependency on `events` — both for requesting the flush and for observing completion. The "fully isolated" framing was hiding a real coupling. The revised graph:

```
convert ← events (request flush, observe StateFlushed)
convert ← storage (read snapshot after flush)
convert ← document (snapshot type for deserialization)
```

The conversion timeout contract also needs explicit definition: if `collab` doesn't emit `StateFlushed` within N seconds (e.g., no active WebSocket clients on that document), `convert` falls back to the last materialized snapshot with a `stale: true` flag in the response headers. This is a documented degraded mode, not a silent failure.

---

### TOCTOU in Permission Checking Is a Security Boundary, Not an Implementation Detail

Nobody has addressed when permission evaluation occurs in the intent pipeline. DeepSeek's revised graph says "permissions evaluated at intent submission" — but this creates a time-of-check/time-of-use (TOCTOU) gap: the grant is verified when `POST /api/documents/:id/intents` arrives, but the intent is applied asynchronously by `collab`'s `IntentExecutor`. If the grant is revoked between check and apply (e.g., document owner revokes access while an agent's intent is queued), the intent applies anyway.

**The fix is not complicated but must be made explicit**: `collab`'s `IntentExecutor` must re-evaluate permissions at apply time, not just at submission time. This requires `IntentExecutor` to call into `permissions` — which means `collab` has a dependency on `permissions`. This is a real dependency arrow that must appear in the graph. The alternative (checking only at submission) is a security model that fails silently under concurrent revocation, which is especially dangerous for autonomous agents that may hold intents in queue for seconds.

This also resolves the question of where the `permissions` module sits. It cannot be "Access Domain (Phase 2)" if `collab` needs it at apply time. **`permissions` must be Phase 1**, or the intent pipeline has no access control at the point of mutation.

---

### Synthesis: What Is Actually Settled

The conversation has produced genuine consensus on several points that should be locked:

| Decision | Module | Status |
|---|---|---|
| `DocumentSnapshot` as lingua franca with `documentType` discriminant | `document` | Settled |
| Thin events (8KB PG limit) + transactional outbox | `events` | Settled |
| Zod schemas in `contract.ts` for runtime + compile-time validation | all modules | Settled |
| Redis required for `collab` multi-node | `collab` | Settled |
| OCC for agent intent writes, not OT | `collab` | Settled (above) |
| `collab` is server-only; frontend binding is wiring in `app` | `collab` | Settled |
| Schema version + migration registry | `document` | Settled |

**Still genuinely open**: the telemetry/observability module (DeepSeek's proposal, no pushback, no adoption — it's correct and should be in kernel); offline intent queuing (real concern, but belongs in `app`'s frontend binding, not `collab`); and whether the SSE stream endpoint is sufficient for Phase 1 agent integration or whether webhook delivery is required earlier than anticipated.

---

## Gemini (2026-04-06T20:55:38.745Z)

## Challenging the TOCTOU Permission Fix: Do Not Block the Y.js Event Loop

Claude's identification of the Time-Of-Check/Time-Of-Use (TOCTOU) gap in intent application is correct, but the proposed fix—forcing `collab` to re-evaluate permissions synchronously during the `IntentExecutor` apply phase—introduces a fatal architectural bottleneck. 

**The Flaw**: Y.js merges are synchronous, CPU-bound operations. If `IntentExecutor` must call the `permissions` module (which implies a database or Redis lookup to evaluate the ACL) for every intent before applying it, we introduce network I/O into the collaborative sync loop. This will destroy the latency guarantees of the editor for everyone on that node.

**Concrete Mechanism: Asynchronous Revocation via Choreography**
`collab` must **not** depend on `permissions`. Instead, we embrace the asynchronous nature of the system:
1. `permissions` evaluates the initial intent at the `api` boundary (Time of Check). 
2. If a user's or agent's access is revoked mid-session, `sharing` updates the ACL and `permissions` emits a `GrantRevoked` event via the Redis backplane.
3. `collab` subscribes to `GrantRevoked`. When received, it instantly terminates active WebSockets for that principal and drops any queued intents for them in memory.
*Trade-off*: We accept a ~10-50ms TOCTOU window (pub/sub latency) where an intent might slip through after revocation. In exchange, we preserve the pure CPU-bound performance of the CRDT engine and keep `collab` decoupled from access control I/O.

## The Novel Problem: The OCC "Retry Storm"

We have settled on Optimistic Concurrency Control (OCC) for agent intents (returning `409 Conflict` on stale `baseRevision`). However, this introduces a catastrophic failure mode: naive agents. 

If an LLM or autonomous agent receives a 409, its programmatic loop will likely instantly re-fetch the snapshot and re-submit the intent. In a highly active document, the agent will repeatedly hit 409s, causing a "retry storm" that overwhelms the `api`, the Redis backplane, and the `storage` layer.

**Concrete Mechanism: Discriminated Rate Limiting at the Edge**
The `api` module must implement a strict, stateful rate limiter explicitly aware of the `actorType` provided by the `auth` kernel module.
*   `human` actors get high burst limits (to accommodate rapid UI interactions and debounced saves).
*   `agent` actors get a strict Token Bucket limit for write attempts (e.g., 2 modifications per second) and are issued `429 Too Many Requests` with a mandatory `Retry-After` header when exceeded. 
This protects the infrastructure from runaway agent loops without penalizing human collaborators.

## Formalizing Telemetry for Agentic Tracing

DeepSeek correctly identified `telemetry` as the missing kernel module. If we are mixing human WebSocket operations and Agent REST intents, debugging a corrupted document will be impossible without distributed tracing.

**Concrete Mechanism: W3C Trace Context as a First-Class Contract**
The `telemetry` module should be a thin wrapper around **OpenTelemetry (OTel)**. 
Crucially, every `DocumentIntent` submitted by an agent must support standard W3C `traceparent` headers. 
1. The `api` module parses the trace ID.
2. The trace ID is passed through the Zod schema and into the Redis backplane.
3. `collab` attaches this trace ID to the Y.js operations (using Y.js's metadata/origin features).
4. The final `DocumentUpdated` thin event includes this `trace_id`.

*Testable Hypothesis*: By injecting the `trace_id` into the Y.js transaction origin, we can mathematically prove whether a specific visual change in the UI was authored by a human typing or an LLM intent, purely by querying our APM/logging backend.

## Refining the SSE Stream: The "410 Gone" Contract

Claude's proposal for `api` exposing SSE (`GET /api/events/stream`) using `Last-Event-ID` elegantly solves agent observation. However, it requires a strict boundary on the Transactional Outbox retention. If an agent goes offline for a month and reconnects with an ancient `Last-Event-ID`, the outbox will have pruned the event.

**Concrete Mechanism**: 
The `events` module contract must define a strict `OutboxRetentionPolicy` (e.g., 7 days). If `api` receives an SSE connection request with a `Last-Event-ID` that falls behind the prune threshold, it must **reject the connection with `410 Gone`**. 
This forces the agent to execute a fallback routine: re-fetch the absolute state (`GET /api/documents/:id`), establish a new `baseRevision`, and reconnect to the SSE stream without a `Last-Event-ID` to start fresh. This prevents the `events` database from growing infinitely while providing a deterministic recovery path for agents.

### The Final, Hardened Dependency Graph

```text
Kernel (Tolerates failures, initializes first):
  telemetry ← OTel tracer, W3C traceparent propagation
  auth      ← Identity, actorType ('human' | 'agent')
  storage   ← S3/PG Adapters, hot/cold lifecycle
  events    ← Thin events, Redis Pub/Sub, PG Outbox (7-day TTL)

Document Domain:
  document  ← Snapshot Unions, Zod Contracts, Migrations
  collab    ← Hocuspocus/Y.js, Redis Leader Election, OCC Engine
              (Listens to GrantRevoked to drop connections/intents)

Access Domain:
  permissions ← ACL Evaluation (Checked at API boundary)
  sharing     ← Grant management

Integration:
  convert   ← Listens to events, requests synchronous flush
  api       ← REST/SSE, Zod validation, Agent Rate Limiting
  app       ← Frontend UI, TipTap binding, Offline queue
```

---

## DeepSeek (2026-04-06T20:56:44.658Z)

## Building on Core Insights, Challenging Consensus

### 1. The "Collab Client" Question Reveals a Deeper Pattern Boundary

The debate over whether `collab` should have a client component exposes a fundamental architectural pattern we've missed: **Dependency Inversion for State Synchronization**.

Instead of splitting by server/client, we should split by **synchronization protocol**:
- `collab-sync`: Defines the synchronization protocol interface (connect, applyOperation, getStateVector)
- `collab-server`: Implements protocol via WebSocket + Hocuspocus + Redis
- `collab-offline`: Implements protocol via IndexedDB + operation queue

Both `collab-server` and `collab-offline` depend on `collab-sync`. The editor binding imports `collab-sync` and receives the appropriate implementation at runtime.

This solves the offline problem cleanly: during initialization, the app checks network status and injects either `collab-server` (online) or `collab-offline` (offline) adapter into the editor. The editor knows nothing about the difference.

**Testable hypothesis**: If we can write a unit test that swaps synchronization adapters without touching editor code, the boundary is correct.

### 2. The Telemetry Module Is Actually Three Concerns

DeepSeek's `telemetry` proposal conflates:
- **Observability** (logs, metrics, traces)
- **Audit logging** (who did what, for compliance)
- **Agent debugging** (intent transformation replay)

These have different retention policies, query patterns, and privacy implications. We need:
- `observability`: Standard OpenTelemetry with short retention (days)
- `audit`: Immutable event log with long retention (years), stored separately
- `replay-log`: High-fidelity intent/operation recording for debugging agent behavior

The critical insight: **Agent debugging requires capturing the exact Y.js operation sequence**, not just the intent. We need a `replay-log` module that records:
```typescript
interface ReplayEntry {
  timestamp: ISOString;
  actorId: string;
  actorType: 'human' | 'agent';
  baseRevision: string;
  operations: YjsOperation[]; // The actual CRDT ops generated
  intent?: DocumentIntent; // The original intent (if agent)
}
```

This belongs in `collab` internals, not the kernel.

### 3. The Rate Limiting Problem is Actually a Workflow Problem

Gemini's rate limiting solution treats symptoms, not causes. The real problem: **agents lack workflow context**.

If an agent receives a 409 Conflict, it shouldn't retry immediately—it should:
1. Check if the conflicting change was from a human (via `audit` log)
2. Determine if the intent is still relevant given the new document state
3. Possibly wait for human review before retrying

This suggests we need a **workflow orchestration boundary** that agents can plug into:
- `workflow-orchestrator`: Manages multi-step agent operations, handles conflicts, coordinates with human approval when needed
- Lives outside the core but consumes `events` and `audit`

For Phase 1, we simply document that agents must handle 409s intelligently. But the architecture must reserve space for this orchestrator by ensuring `events` and `audit` provide sufficient context.

### 4. The Hardest Real Problem: Schema Migration During Active Editing

Claude's schema migration proposal assumes documents are inert between migrations. But what happens when:
1. Client A is editing a v1 schema document
2. Migration v1→v2 deploys
3. Client B opens the same document

Options:
- **Blocking migration**: Client B waits while document migrates (bad UX)
- **Fork and merge**: Client B gets migrated copy, edits diverge (complex)
- **Live migration**: Editor understands multiple schema versions (heavy)

The correct answer emerges from our architecture: **`collab-server` always works with the latest schema**. When Client A connects with old schema:
1. `collab-server` migrates the document to latest schema in memory
2. Operations from Client A are transformed through migration layer
3. Client A receives operations in its schema version

This requires the `document` module to provide **bidirectional operation transformers**, not just snapshot migrators. This is non-trivial but essential for zero-downtime updates.

### 5. The Final Module Map with Clear Interfaces

```
Kernel:
  identity      (was auth) - principals only
  persistence   (was storage) - abstract key-value interface
  messaging     (was events) - pub/sub with delivery guarantees

Observability Layer (cross-cutting):
  observability - OpenTelemetry integration
  audit         - immutable compliance log
  replay-log    - agent debugging capture

Document Domain:
  document      - schema, snapshot types, migration transformers
  collab-sync   - synchronization protocol interface
  collab-server - online implementation (Hocuspocus + Redis)
  collab-offline- offline implementation (IndexedDB + queue)

Access Domain:
  permissions   - ACL evaluation (pure function, no I/O)
  grants        - grant management (depends on persistence)

Integration:
  web-api       - REST + SSE, input validation
  ws-gateway    - WebSocket server mounting collab-server
  convert       - format conversion service
  app           - frontend shell + editor binding
```

**Key innovations**:
1. `identity` separated from OIDC implementation (auth becomes adapter)
2. `persistence` as pure key-value, no business logic
3. `messaging` with guaranteed delivery, not just pub/sub
4. Observable modules separated by retention/use case
5. Collab split by protocol, not by server/client

**Test for correctness**: Can we implement a Markdown editor reusing `document`, `collab-sync`, and `persistence` without touching `collab-server` or `collab-offline`? If yes, the boundaries are right.

The unsolved challenge: **How do we test bidirectional operation transformers for schema migration without creating fragile snapshot comparisons?** This requires property-based testing with generated document histories—a research problem unto itself.

---

## Mistral (2026-04-06T20:56:44.899Z)

[No response - authentication error]

---

> **Moderator**: ## Structured Summary

## Key Findings

- **`document` module as the lingua franca**: `DocumentSnapshot` (with `documentType` discriminant union, `SchemaVersion`, Zod schemas, and a migration registry) is the stable interface shared across all domain boundaries — the single most load-bearing architectural decision in Phase 1.
- **Thin events + transactional outbox**: PostgreSQL's 8KB `NOTIFY` limit forces a thin-event model (aggregateId + revisionId only, no payload); a PG-backed transactional outbox with a defined TTL (e.g., 7 days) and SSE replay via `Last-Event-ID` provides the complete agent observation loop without bespoke infrastructure.
- **OCC over OT for agent writes**: Agents must declare a `baseRevision` on every `DocumentIntent`; the `collab` module's `IntentExecutor` rejects stale intents with `409 Conflict` (including `currentRevision` + `currentStateVector` for delta computation), forcing agents to re-read and reformulate — this matches Google Docs/Notion/Confluence API semantics and is technically correct given Yjs's lack of reconstructible historical snapshots.
- **Redis is a hard production dependency**: Hocuspocus's `@hocuspocus/extension-redis` already requires Redis for multi-node; routing intent RPCs to the document-owning node via a per-document Redis channel (`document:{id}:intents`) eliminates the need for a bespoke PG-backed registry and its split-brain failure modes.
- **TOCTOU in permission checking is real and requires async revocation**: `collab` must NOT call `permissions` synchronously in the CRDT apply path (blocks the event loop); instead, `permissions` emits `GrantRevoked` events that `collab` subscribes to, terminating connections and dropping queued intents within pub/sub latency (~10–50ms accepted window).

## Confidence Levels

- **HIGH**: `DocumentSnapshot` discriminated union with `documentType` + `schemaVersion` as the system lingua franca; Zod `contract.ts` for runtime+compile-time validation; `collab` is server-only (frontend binding is wiring in `app`); Redis required for multi-node `collab`; thin events with PG outbox; SSE stream at `GET /api/events/stream` as the Phase 1 agent observation surface; `permissions` must be Phase 1 (not deferred), required at both API boundary check and async revocation.
- **MEDIUM**: OCC via `baseRevision` for agent intents — technically correct against Yjs constraints, but the practical retry behavior of LLM agents under frequent 409s is unvalidated; rate limiting `agent` vs `human` actorTypes in `api` is sound in principle but thresholds are unspecified; `convert` module's dependency on `events` for flush-before-export is architecturally correct but adds latency that needs explicit SLA definition.
- **LOW**: DeepSeek's `collab-sync` / `collab-server` / `collab-offline` protocol-inversion split — conceptually clean but introduces significant interface complexity for a Phase 1 scope; bidirectional operation transformers for live schema migration during active editing sessions — raised as a real problem, no validated solution proposed; the `replay-log` / `audit` / `observability` three-way telemetry split — correct in principle but may be premature decomposition for Phase 1.

## Open Questions

- **Snapshot consistency contract for REST reads**: Is eventual consistency (last materialized snapshot) acceptable as the default, or does the `If-Match: revisionId` causal-read header need to be mandatory on all `GET /documents/:id` calls? The answer determines whether agents can safely act on REST responses without always specifying a revision.
- **Intent acknowledgement model**: Is a synchronous response (with new state vector) from `IntentExecutor` feasible given the Redis-channel routing mechanism, or does the 202-Accepted + SSE event pattern become mandatory in multi-node deployments where the request may not land on the document-owning node?
- **Telemetry module scope in Phase 1**: Is a full OpenTelemetry kernel module required on day one, or is structured logging with W3C `traceparent` propagation through intent payloads sufficient to defer the `telemetry` module to Phase 2 without losing agent debuggability?
- **Schema migration during active sessions**: The bidirectional operation transformer requirement for zero-downtime schema upgrades has no concrete proposed mechanism — is this a Phase 1 constraint or explicitly deferred with a documented "maintenance window" migration policy?
- **`convert` degraded mode SLA**: What is the defined timeout before `convert` falls back to the stale snapshot, and does the `stale: true` response header meet downstream consumer requirements (search indexing, export UX)?

## Suggested Follow-ups

1. **Intent routing and acknowledgement under multi-node `collab`**: A focused session on the Redis-channel RPC mechanism — specifically the fallback path when no node responds (dormant document), the synchronous acknowledgement contract, and whether sticky routing or a lightweight ownership record is required — this is the highest-risk unresolved implementation detail.
2. **Agent integration contract surface (`api` module specification)**: Define the exact HTTP API contract for the full agent loop (SSE subscription → causal read → intent submission → 409 handling → retry policy), including the `410 Gone` reconnect protocol, `actorType`-discriminated rate limit parameters, and the `IntentConflict` response schema — this is the external-facing contract that cannot be refactored cheaply once agents integrate.
3. **`permissions` module Phase 1 scope and the async revocation event contract**: The `GrantRevoked` event is the critical dependency arrow between `sharing`/`permissions` and `collab` — a session on the exact ACL evaluation model, the grant data schema, and the guaranteed delivery semantics needed for the revocation path would close the last major security boundary question.

## Verdict

The core module boundaries are sufficiently debated and converging, but the session requires at least one more targeted session on the agent intent routing/acknowledgement mechanism and the `permissions`-to-`collab` revocation contract before the architecture is implementation-ready.

