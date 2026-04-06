# AI Deliberation: Research: Should OpenDesk use Yjs or Automerge for CRDT-based real-time collaboration?

*Started: 2026-04-06T20:08:33.254Z*

## System Prompt

You are participating in a focused research session.

**Research Topic**: Should OpenDesk use Yjs or Automerge for CRDT-based real-time collaboration?

**Context/Background**: OpenDesk is a sovereign office suite MVP focused on collaborative document editing. Stack: TipTap editor, Node.js backend, WebSocket sync, PostgreSQL + S3 storage. Key requirements: real-time multi-user editing, self-hostable, low latency, good TipTap integration, active maintenance, permissive license compatible with AGPL-3.0. Phase 1 is documents only (rich text), Phase 2 adds spreadsheets.

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


> **Moderator**: The central question before us is whether Yjs or Automerge better serves OpenDesk's need for robust, low-latency collaborative editing — a choice that will shape the architecture of every real-time feature from Phase 1 rich text through Phase 2 spreadsheets. To answer this rigorously, we'll need to probe three specific sub-questions: How deeply does each library integrate with TipTap's ProseMirror model, and what does that integration cost in complexity or performance? How do their conflict-resolution semantics hold up under concurrent edits to structured document content, and do those semantics extend cleanly to spreadsheet data models? And finally, how do their persistence, network transport, and self-hosting stories align with a Node.js/WebSocket/PostgreSQL stack running under AGPL-3.0? Let's work through each dimension methodically before drawing any conclusions.


## Claude (2026-04-06T20:09:56.625Z)

## Opening Position: Yjs Wins on Pragmatics, But the Interesting Fight Is in the Semantics

Let me cut to what I think is the decisive asymmetry, then flag where the real intellectual difficulty lies.

---

### The TipTap Integration Gap Is Not Symmetric

This isn't a close call on dimension one. The TipTap team *maintains* both the collaboration extension (`@tiptap/extension-collaboration`) and Hocuspocus — and both are built on Yjs. What this means concretely:

- **`y-prosemirror`** maps ProseMirror's document tree to `Y.XmlFragment` with a well-tested bidirectional binding. Marks become XML attributes. Node types become `Y.XmlElement`. This mapping has been production-exercised at scale.
- **Automerge has no equivalent ProseMirror binding.** `@automerge/automerge-codemirror` exists for CodeMirror (a simpler flat model), but ProseMirror's recursive schema with marks, node types, and inline/block distinction is meaningfully harder to map. You'd be writing this yourself.

The cost of that gap isn't just engineering hours — it's an ongoing maintenance burden against TipTap schema changes, and a correctness surface you own entirely. That's a significant risk for an MVP.

**Testable hypothesis**: Implement a minimal "concurrent bold-and-insert" test case with both libraries. With Yjs + `y-prosemirror` this is ~20 lines of setup. With Automerge + custom ProseMirror binding, estimate your effort before committing.

---

### Where Automerge Has Genuine Theoretical Edge: Peritext

Here's where I'll push *against* the easy Yjs conclusion. Automerge's text CRDT implements **Peritext** (Litt et al., Ink & Switch). The core problem Peritext solves that Yjs handles poorly:

> User A types inside a bold span. Concurrently, User B removes the bold mark. What formatting does A's text get?

In `y-prosemirror`, concurrent mark operations use last-write-wins at the mark level, which can produce unintuitive results — text inserted "inside" a mark by one client ends up unformatted after another client's concurrent deletion resolves. Peritext formalizes **mark expansion semantics** so that a mark's boundary behavior (does it expand to include adjacent insertions?) is part of the CRDT state, not an afterthought.

**However** — and this is important — Automerge's rich text (`AutomergeText` with mark support) is still maturing. The Peritext semantics are principled but the implementation is newer than y-prosemirror's battle-testing. Speculative advantage until someone runs the adversarial concurrent-edits test suite against both.

---

### The Hardest Unsolved Problem: Phase 2 Spreadsheets

Neither library helps you with what's actually hard about collaborative spreadsheets: **formula dependency graphs under concurrent edits**.

Consider: User A sets `B1 = SUM(A1:A10)`. Concurrently, User B deletes row 3. The CRDT can merge the document state, but now you need to:
1. Decide what `A1:A10` means after row deletion (range shifting)
2. Recalculate dependents without triggering cycles introduced by concurrent formula edits

This is a **domain problem above the CRDT layer** — neither Yjs's `Y.Map`-per-cell nor Automerge's equivalent gets you here. You'll need a formula engine (HyperFormula is the obvious choice) that is CRDT-aware, and the correctness of range references under concurrent structural mutations is genuinely unsolved at the library level.

**The implication**: The CRDT choice matters less for Phase 2 than you might think. What matters is whether you can hook into the CRDT's operation stream to drive formula recalculation. Both libraries expose this — Yjs via `observe`/`observeDeep`, Automerge via `change`/`patch` listeners — so neither has a structural advantage here.

---

### Persistence and Self-Hosting: Yjs + Hocuspocus Is Ready, Automerge Isn't

For the Node.js/WebSocket/PostgreSQL stack:

- **Hocuspocus** (maintained by TipTap team) gives you a production-grade Yjs server with PostgreSQL persistence, webhook support, and authentication hooks out of the box. MIT licensed. Compatible with AGPL-3.0.
- **`automerge-repo`** has storage adapters, but the PostgreSQL story requires you to write your own adapter or use `automerge-repo-storage-nodefs` and accept filesystem storage. There's no Hocuspocus equivalent.

The network protocol matters too: Yjs uses a compact binary diff format over WebSocket with the `y-websocket` protocol. Automerge's sync protocol is well-designed but the Node.js server infrastructure is younger and less documented.

---

### My Position

**Use Yjs for Phase 1.** The TipTap/Hocuspocus ecosystem lock-in is a feature here, not a risk. The integration is proven, the persistence story is solved, and the licensing is clean.

**The open question worth investigating before locking in**: Does `y-prosemirror`'s mark conflict behavior cause perceptible bugs in realistic concurrent editing scenarios? If collaborative formatting edits are a core use case, run the adversarial tests against Peritext semantics. If they reveal real UX failures, that reopens the Automerge conversation — but only if you're willing to fund the ProseMirror binding work.

**For Phase 2**: The CRDT choice is largely irrelevant to the hardest problems. Spend that research time on the HyperFormula + CRDT operation-stream integration instead.

---

## Gemini (2026-04-06T20:10:34.910Z)

I strongly agree with Claude’s pragmatic conclusion—Yjs is the undeniable choice for Phase 1 simply due to the TipTap/Hocuspocus ecosystem. However, I want to challenge the claim that the CRDT choice is "irrelevant" for Phase 2 spreadsheets, and introduce two critical technical dimensions Claude missed: **Collaborative Undo semantics** and **CRDT compaction strategy for PostgreSQL + S3**.

---

### The Hidden MVP Killer: Collaborative Undo

Claude rightly pointed out the Peritext advantage in Automerge for formatting boundaries, but missed the hardest UX problem in collaborative text: **Undo**. 

If User A types "Hello", User B inserts " World", and User A hits `Cmd+Z`, User A's "Hello" must vanish *without* touching User B's " World". ProseMirror’s native undo history is strictly linear and breaks instantly under concurrent remote changes. 

Yjs solves this out-of-the-box with `Y.UndoManager`, which seamlessly tracks local-only origins within specific `Y.XmlFragment` scopes while gracefully rebasing around remote edits. 

If you choose Automerge, you aren’t just writing a custom ProseMirror binding; you are mathematically deriving a local-only undo history against a distributed patch stream. That is a multi-month research project on its own. For an MVP, Yjs’s `UndoManager` is the true moat.

---

### Pushback: CRDT Choice *Deeply* Matters for Phase 2 (Spreadsheets)

Claude stated that formula dependency graphs make the CRDT choice irrelevant for Phase 2. I disagree. While the *evaluation* engine (like HyperFormula) is separate, the **memory overhead and state mapping of the grid** are fiercely dependent on the CRDT.

A spreadsheet is not a document tree; it’s a massive, dense key-value store or 2D array. 
*   **Yjs Overhead:** Mapping a 10,000-cell grid as a `Y.Map` of `Y.Maps` creates massive object instantiation overhead in V8. Every cell becomes an observable `Y.Type` with its own clock and tombstone metadata. 
*   **Automerge Advantage:** Automerge treats state as an immutable, JSON-like tree backed by a highly optimized WASM core. Updating a deeply nested cell in a massive JSON object in Automerge is often vastly more memory-efficient than Yjs's deeply nested `Y.Map` references.

**The Hybrid Approach for Phase 2:** If OpenDesk commits to Yjs in Phase 1, Phase 2 cannot naively map 1 cell = 1 `Y.Type`. You will likely need to store chunked grid state (e.g., a `Y.Map` where keys are `row_chunks` and values are flat JSON strings of cell data), sacrificing character-by-character cell collaboration for massive performance gains, letting HyperFormula handle the granular execution locally.

---

### Architecture: Solving CRDT Bloat with PostgreSQL + S3

OpenDesk’s stack dictates Node.js + PostgreSQL + S3. CRDTs are append-only logs of tombstones and operations. If every keystroke is a database row or an S3 object, your infrastructure will choke.

Hocuspocus (Yjs) integrates beautifully here via custom Storage Extensions, allowing a **Hot/Cold Storage Tiering** model that Automerge-repo doesn't yet cleanly offer off-the-shelf for this specific stack:

1.  **Hot (PostgreSQL):** Hocuspocus buffers active WebSocket connections, using Postgres to store incremental `Y.encodeStateAsUpdate` diffs for fast reconnects.
2.  **Cold (S3):** When a document goes dormant (no WebSocket activity for *n* minutes), a Node.js worker performs a `Y.applyUpdate` consolidation, generates a single highly compressed binary blob (`Y.encodeStateAsUpdateV2`), pushes it to S3, and truncates the Postgres diffs. 

Automerge's binary format is arguably better compressed natively, but Yjs provides the exact hooks (`onStoreDocument`, `onLoadDocument`) needed to implement this Pg/S3 dance perfectly.

---

### Testable Hypotheses to Validate Yjs

Before declaring Yjs the total winner, OpenDesk should test these specific failure modes:

1.  **The Collaborative Undo Test:** Map a `Y.UndoManager` to a `y-prosemirror` instance. Have Client A and B type interleaved text into the same paragraph. Verify Client A can undo their changes cleanly. (Validates Phase 1 viability).
2.  **The Spreadsheet Memory Bomb Test:** Instantiate a `Y.Map` containing 10,000 nested `Y.Map`s (representing a 100x100 cell grid). Perform 1,000 random cell value updates. Measure JS heap size and the size of the `Y.encodeStateAsUpdate` payload. (Validates if Phase 2 requires data chunking).

---

## DeepSeek (2026-04-06T20:11:25.016Z)

## Building on the Critical Points

Both Claude and Gemini correctly identify Yjs as the pragmatic choice for Phase 1 due to the TipTap/Hocuspocus ecosystem. However, I'll challenge Gemini's characterization of the undo problem and reveal a deeper architectural implication that neither addressed: **how the CRDT's conflict resolution model dictates your persistence layer's transaction boundaries.**

### Collaborative Undo is Solved Differently Than You Think

Gemini rightly flags undo as critical but oversimplifies the solution space. `Y.UndoManager` works, but it's a *local* undo stack that gets rewound through remote operations—this creates a subtle but important constraint: **you cannot implement "undo last change by any user" without building a distributed undo ledger on top.**

The real distinction isn't implementation ease (Yjs wins), but semantic capability. Automerge's immutable history tree actually enables **causal undo**—tracking the chain of operations that led to a state—whereas Yjs's mutable document model with local undo makes cross-user undo nearly impossible without significant extension.

For an MVP, local undo suffices. But if OpenDesk's vision includes Google Docs-style "see who changed what and revert their edit," Automerge's data model provides a cleaner foundation. This isn't a Phase 1 concern, but it's architectural debt worth acknowledging.

### The Real Spreadsheet Challenge: Causal Ordering of Range Shifts

Both underplay why CRDT choice matters for spreadsheets. It's not just memory overhead—it's **how the CRDT preserves causal ordering of structural mutations that affect formula ranges**.

Consider:
- User A at t=1: Insert row at position 5 (shifting rows 5+ down)
- User B at t=2 (but before seeing A's change): Set `B10 = SUM(A1:A10)`

In a state-based CRDT (Automerge's default), these operations commute and you get correct merging: the formula's range `A1:A10` adjusts to the row insertion. In an operation-based CRDT (Yjs), you must ensure the insertion operation reaches all clients before formula creation, otherwise `B10` references the wrong cells.

Yjs can handle this with **vector timestamps and causal ordering**, but you must explicitly manage it. Automerge's immutable state tree automatically preserves causality through its change hashes.

**Testable hypothesis**: Implement a row insertion + concurrent formula creation stress test. Measure how often formulas reference incorrect cells under network partitions. I predict Automerge will outperform Yjs without custom causal ordering logic.

### The Persistence Layer Transaction Problem

Here's the novel architectural insight: **Yjs's mutable document model forces your PostgreSQL adapter to handle snapshot isolation differently than Automerge's immutable changes.**

When Hocuspocus persists a Yjs document to PostgreSQL, it stores:
1. The current binary state snapshot
2. Individual updates for recent changes

But Yjs's updates are *relative to a specific state version*. If two clients disconnect concurrently and reconnect to a new server instance, merging their changes requires reconstructing the exact state version they diverged from.

Automerge's changes are self-contained—each change has a hash of its dependencies. Your PostgreSQL storage can be a simple append log of changes, and merging is always possible by replaying the dependency graph. This makes cold storage (S3) and multi-server synchronization significantly simpler.

**Concrete mechanism**: With Automerge, you can implement a robust S3 cold storage by periodically writing the change log to a single file. With Yjs, you must store the exact state vector alongside each snapshot to enable future merging.

### Recommendation with a Caveat

**Proceed with Yjs for Phase 1**, but with these guardrails:

1. **Implement adversarial testing immediately** on:
   - Concurrent formatting operations (bold insertion during mark deletion)
   - Network partition recovery with pending local changes
   - Large document (>100KB) merge performance

2. **Design your PostgreSQL schema for both CRDTs** during Phase 1. Store:
   - Document ID
   - CRDT type (Yjs/Automerge)
   - Binary state
   - State vector / change hash dependencies
   - Update log

This keeps the Automerge door open if Phase 2's spreadsheet requirements reveal Yjs's causal ordering limitations.

3. **For Phase 2**, prototype the spreadsheet engine against both CRDTs using a common abstraction layer. The extra upfront cost is justified by the risk that Yjs's memory overhead and causal ordering requirements become blockers at spreadsheet scale.

The hardest unsolved problem isn't which CRDT to choose—it's **how to maintain clean abstraction boundaries between your collaboration layer and domain models** so you can migrate between CRDTs when their respective limitations emerge.

---

## Mistral (2026-04-06T20:11:25.200Z)

[No response - authentication error]

---

## Claude (2026-04-06T20:12:49.488Z)

## Advancing the Conversation: Three Corrections and One Novel Dimension

### 1. DeepSeek's CRDT Taxonomy Is Wrong, Which Undermines the Phase 2 Formula Argument

DeepSeek classifies Automerge as a "state-based CRDT" and Yjs as "operation-based," then builds the formula range-shifting argument on that distinction. This is incorrect. **Both are operation-based CRDTs** — Automerge maintains an append-only operation log internally; its sync protocol can transmit compressed state snapshots, but that's a transport optimization, not a classification.

More critically, the formula range adjustment claim — "the formula's range `A1:A10` adjusts to the row insertion" — is not a CRDT property at all for either library. No CRDT knows that `A1:A10` is a range reference that should shift when a row is inserted. That semantic lives entirely above the CRDT layer in the formula engine. The CRDT sees `B10`'s value change to a string; it has no concept of what that string means. DeepSeek's hypothesis that "Automerge will outperform Yjs without custom causal ordering logic" conflates document merge correctness with formula reference semantics — they're independent problems.

**The actual causal ordering question** for spreadsheets is whether concurrent structural mutations (row insert + column delete) produce a consistent cell addressing scheme across clients. Both libraries handle this equivalently poorly — you need an application-level cell identity scheme (stable row/column IDs rather than positional references) regardless of CRDT choice.

---

### 2. The Awareness Protocol Gap Is Underappreciated

Nobody has mentioned that real-time collaboration requires *two* distinct data channels:

- **Document state** (CRDT): persisted, merged, eventually consistent
- **Ephemeral presence** (cursors, selections, user status): unpersisted, low-latency, TTL-based

Yjs ships **`y-protocols/awareness`** as a first-class primitive — a lightweight gossip protocol with monotonic clock and TTL that propagates cursor positions and selection state without touching the CRDT document. Hocuspocus automatically bridges this over WebSocket. TipTap's `CollaborationCursor` extension is built on top of it.

Automerge has no equivalent. Building presence on top of `automerge-repo` requires either (a) a separate pub/sub channel with custom serialization, (b) abusing Automerge documents as ephemeral state stores (wrong tool — you don't want cursor positions in your CRDT history), or (c) a third-party presence library wired up manually.

For an MVP where "real-time multi-user" implies showing collaborators' cursors, this gap is load-bearing. It's not insurmountable, but it's another surface that Automerge users build themselves.

---

### 3. "Keep Both Doors Open" Is Not a Storage Abstraction — It's a Document Model Migration

DeepSeek recommends designing the PostgreSQL schema to accommodate both CRDTs. The problem: Yjs and Automerge don't just differ in binary format — they use fundamentally different document models for rich text.

- Yjs represents a ProseMirror document as `Y.XmlFragment` — a typed XML tree with marks as attributes
- Automerge would represent the same document as... whatever schema you invented when writing the custom binding

These aren't swappable blobs. Migrating from Yjs to Automerge in Phase 2 would require **converting every document** — deserializing from `Y.XmlFragment`, reconstructing the document structure, and re-encoding it into Automerge's JSON schema. That's a data migration problem across your entire document corpus, not a storage adapter swap.

The "abstraction layer" recommendation creates false confidence. If you're going to migrate CRDTs, commit to it with eyes open about the document conversion cost. If you're not, stop paying the abstraction tax.

---

### 4. Gemini's Hot/Cold Tiering Is Right, But Understates the GC Correctness Risk

The hot (PostgreSQL) / cold (S3) tiering model is the right architecture. But Gemini frames Y.js's snapshot consolidation as straightforward. The hidden constraint: **safe Yjs garbage collection requires knowing the minimum state vector across all ever-connected clients**.

Yjs tracks deleted content as tombstones until it can prove no client will ever request a state older than the deletion. If you compact a document snapshot to S3 and a client reconnects with a stale state vector predating the compaction, the server cannot reconstruct the diff they need — you've lost the ability to bring that client back into sync without a full document reload.

**Concrete requirement this creates**: Your PostgreSQL hot layer must store not just the current state but the minimum state vector of all clients that might reconnect. You need either:
- A max-offline-duration policy (clients offline longer than N hours get forced reload)
- Server-side client registration tracking state vectors before allowing GC

Hocuspocus doesn't handle this automatically. The `onStoreDocument` hook gives you the moment of compaction, but the client reconnection handling requires you to implement the state vector floor check. This is solvable — but document it as a known architectural constraint, not an incidental detail.

---

### Net Position

The Yjs recommendation stands, but the honest summary of the remaining risk surface is:

| Risk | Severity | Mitigation |
|---|---|---|
| Mark conflict semantics (Peritext gap) | Medium — run adversarial tests | Accept or contribute upstream |
| Awareness protocol (cursor presence) | Low — Yjs solves this | Already handled by Hocuspocus |
| GC compaction + stale client reconnect | Medium | Implement state vector floor + forced reload policy |
| Phase 2 spreadsheet memory overhead | High — validate early | Prototype Y.Map with 10K cells before committing |
| CRDT migration if Phase 2 fails | High — it's a corpus migration | Don't architect for it; decide once |

The most honest advice: don't architect for optionality you won't exercise. Pick Yjs, stress-test the specific failure modes above, and treat any future CRDT migration as a product decision with real migration cost — not a configuration change.

---

## Gemini (2026-04-06T20:13:27.735Z)

## Escaping the Phase 2 Trap and the Overlooked Cost of WASM

We have consensus on Yjs for Phase 1. Claude correctly dismantled the abstraction layer fallacy and the "state vs. op-based" confusion. However, I need to completely defuse Gemini's "Spreadsheet Memory Bomb" fear for Phase 2, and introduce a critical architectural constraint regarding deployment that no one has touched: **The WASM execution environment tax.**

---

### 1. Defusing the Phase 2 Memory Bomb: The Flat Map Architecture

Gemini argued that Yjs would choke on a 10,000-cell grid because mapping it requires "10,000 nested `Y.Map`s." This is a fundamental misunderstanding of how to design CRDT schemas for dense data. 

**You absolutely do not nest `Y.Type`s for a spreadsheet.** Every nested `Y.Map` or `Y.Array` incurs overhead because it initializes its own event emitter, clock, and tombstone tracker. 

Instead, the proven pattern for high-density grids in Yjs is a **Single Flat `Y.Map`**:
*   The `Y.Map` represents the entire worksheet.
*   Keys are deterministic cell coordinates (e.g., `"R1C1"`, `"R1C2"`).
*   Values are *primitives* (strings, numbers, or serialized JSON objects for cell metadata + formula).

**Why this works:** V8 handles a single Map with 10,000 keys trivially. Concurrent edits to `R1C1` and `R2C5` merge perfectly without conflict. If two users edit `R1C1` concurrently, it resolves via standard LWW (Last Write Wins) based on client ID, which is exactly the correct semantic for a single cell (you cannot logically "merge" a cell containing `=SUM(A1:A5)` and `Hello World`—one must win).

By using a flat `Y.Map` with primitive values, Yjs's memory overhead scales linearly with *modified cells*, not grid dimensions. The Phase 2 CRDT memory crisis is a ghost; it's purely a schema design issue.

---

### 2. The Overlooked Deployment Constraint: Pure JS vs. WASM

OpenDesk is building an MVP that needs to be self-hostable (AGPL-3.0) and highly responsive. Everyone is ignoring the client-side payload and execution environment.

*   **Yjs is Pure JavaScript.** It runs identically in the browser, Node.js, Deno, Bun, Cloudflare Workers, and React Native. 
*   **Automerge requires WebAssembly.** The core (`automerge-wasm`) is written in Rust.

The WASM requirement introduces massive friction for an MVP:
1.  **Cold Starts:** If OpenDesk eventually uses edge functions for serverless collaboration routing or webhooks, WASM instantiation adds 50-100ms of cold start latency. Yjs parses instantly.
2.  **Bundle Size:** Shipping the Automerge WASM payload to every web client is a heavy tax for a document editor where initial load time is critical for perceived performance.
3.  **Environment Limitations:** React Native and certain strictly-sandboxed self-hosted environments (e.g., highly restricted CSPs) still struggle with or outright block WASM execution without tedious configuration workarounds. 

For a self-hosted, broadly deployable application, Yjs's pure JS architecture removes an entire class of infrastructure headaches.

---

### 3. The Unsolved Sub-Problem: Server-Side Authority and Validation

Since we are locking into Yjs, we need to talk about the actual hardest problem OpenDesk will face transitioning from a single-player to a multi-player system: **Validating data integrity when the server is just another peer.**

In a standard REST app, the Node.js backend validates every payload before it hits PostgreSQL. In the Yjs/Hocuspocus architecture, the server receives opaque, compressed binary sync messages (`Y.encodeStateAsUpdate`). 

If a malicious or buggy client sends an update that deletes the entire document, or changes a read-only template region, Hocuspocus will dutifully accept it, persist it, and broadcast it. 

**The Concrete Mechanism for OpenDesk:**
To implement secure collaboration, OpenDesk must use Hocuspocus's `onChange` hook to instantiate a headless `Y.Doc` on the server, apply the incoming binary update, and run validation logic *before* broadcasting. 

However, because CRDTs are eventual consistency machines, you cannot easily "reject" an operation. If you reject it, the malicious client is now out of sync with the room, which breaks the CRDT state vector. 
Instead, the server must issue a **Counter-Operation**: 
1. Client A deletes read-only text.
2. Server receives update, applies to local `Y.Doc`.
3. Server detects violation.
4. Server generates a *new* operation restoring the text.
5. Server broadcasts both the original deletion and the immediate restoration.

**Testable hypothesis for the MVP:** Implement a "read-only title" block in TipTap. Write a Hocuspocus webhook that listens for structural deletions of this block and automatically counter-asserts its existence. If the latency of this round-trip causes a distracting UX flicker on the client side, OpenDesk will need to implement complex local-optimistic validation, significantly inflating MVP scope.

### Synthesis

The path forward is unequivocally Yjs, but with strict architectural guardrails:
1.  **Phase 1:** Use `y-prosemirror` and Hocuspocus, but immediately implement server-side headless validation to ensure structural integrity of the TipTap schema against malicious clients.
2.  **Phase 2:** Ignore the "nested Y.Map" panic and use a single Flat `Y.Map` with deterministic coordinate keys for spreadsheets. 
3.  **Infrastructure:** Implement Claude's GC state vector floor in the Postgres/S3 tiering to prevent tombstone corruption. Abandon any notion of an "abstraction layer"—embrace the Yjs document model natively to move fast.

---

## DeepSeek (2026-04-06T20:13:56.346Z)

## Advancing to Concrete Validation & Phase 2 Pragmatics

We agree Yjs is the only viable start for Phase 1. The remaining debate centers on validating its limits and architecting for Phase 2. I’ll refine two critical points and introduce a missing operational consideration.

### 1. The Spreadsheet Schema is a Solved Problem – But Benchmark It
Gemini’s flat `Y.Map` is correct, but the performance claim (“V8 handles 10,000 keys trivially”) needs qualification. While a flat map avoids per-cell `Y.Type` overhead, **Yjs still wraps each value in a `Y.Map` internal structure (`Item`)**. The memory growth is linear with *set* keys, not grid dimensions, but each entry carries a small fixed overhead (clientID, clock, tombstone). For 10k cells, this is fine. For 1M cells (realistic large sheet), it’s ~10-30MB in JS heap before user data—workable but not trivial.

**Testable benchmark**: Create a flat `Y.Map` with 100k coordinate keys, set random values, and measure:
- `Y.encodeStateAsUpdate` size (baseline for network/DB)
- Heap snapshot after 1k concurrent random updates (simulating multi-user edits)
- This validates if chunking (e.g., by row ranges) is needed for extreme scales.

### 2. WASM Concern is Real – But For the Server, Not the Client
Gemini’s WASM point is crucial but misapplied. Automerge’s primary WASM bundle is for browser clients. However, OpenDesk’s Node.js backend would also require the Rust-based `automerge` backend (WASM or native bindings). **This complicates self-hosting on lightweight ARM devices** (e.g., Raspberry Pi) where native builds may fail and WASM interpretation in Node is slow.

Yjs’s pure JS runs anywhere Node runs—no native compilation. For a sovereign suite targeting diverse deployment environments, this is a real advantage. **Hypothesis**: Install `yjs` and `@automerge/automerge` on a Raspberry Pi 4; benchmark merging 10k operations. Yjs will install instantly and run; Automerge may require cross-compilation or suffer WASM interpreter penalties.

### 3. The Missing Operational Risk: Yjs’s GC and Backup/Restore
Claude’s GC correctness risk focuses on stale clients, but there’s a related **backup/restore hazard**. If you periodically snapshot the Yjs document state to S3 for backups, you must also snapshot the **minimum state vector** at that time. Restoring a backup without its corresponding state vector can corrupt future merges if older clients reconnect.

**Concrete mechanism**: When Hocuspocus triggers `onStoreDocument` for S3, serialize:
```json
{
  "snapshot": "<base64 encoded Y.encodeStateAsUpdateV2>",
  "stateVector": "<base64 encoded Y.encodeStateVector>",
  "timestamp": "..."
}
```
Your restore routine must reinstate both. Automerge’s self-contained changes don’t have this issue—backups are just the change log. This adds operational complexity for Yjs.

### 4. Validation Strategy: Simulate Adversarial Networks Early
Beyond testing mark conflicts, OpenDesk should simulate **network partitions with conflicting edits** using a proxy layer (e.g., Toxiproxy) between Hocuspocus and clients. Measure:
- Merge success rate (document should be identical post-reconnect)
- Latency spike during reconciliation
- Whether any TipTap schema invariants break (e.g., node nesting violations)

If Yjs passes, the Peritext advantage becomes theoretical. If it fails, you’ve caught a showstopper before Phase 1 launch.

### Final Synthesis
**Proceed with Yjs**, but:
- **Phase 1**: Implement the adversarial network test immediately. If passes, commit fully—drop any abstraction layer.
- **Phase 2**: Prototype the flat `Y.Map` spreadsheet schema with the 100k-cell benchmark. If memory/performance scales, proceed; else, plan chunking.
- **Operations**: Design the PostgreSQL/S3 tiering with GC state vectors and backup/restore from day one.

The hardest unsolved problem is **secure server-side validation without UX flicker**. Start with the counter-operation pattern, but instrument it heavily; if latency >100ms, you’ll need to move validation to the client with cryptographic signatures—a much heavier lift. That’s your true MVP risk.

---

## Mistral (2026-04-06T20:13:56.727Z)

[No response - authentication error]

---

## Claude (2026-04-06T20:15:56.730Z)

[No response - timed out after 120s]

---

## Gemini (2026-04-06T20:16:32.145Z)

## The Node.js Event Loop Trap and the Reality of Cell-Level Collaboration

We have thoroughly stress-tested the conceptual boundaries of Yjs vs. Automerge and universally landed on Yjs for Phase 1. However, the operational and architectural mechanics proposed for Yjs hide a fatal flaw for Node.js backends, and the "Flat Map" spreadsheet schema breaks a core collaborative UX expectation. 

Here are the specific, unaddressed engineering hurdles we must solve to actually ship this.

### 1. The Hidden Operational Hazard: Yjs Compaction is Synchronous

DeepSeek and Gemini correctly designed a PostgreSQL (hot) / S3 (cold) tiering system. However, they missed the runtime physics of executing this in Node.js. 

Yjs operations (`Y.applyUpdate`, `Y.mergeUpdates`, `Y.encodeStateAsUpdateV2`) are **synchronous, CPU-bound JavaScript execution**. 
If a heavily active document accumulates 50,000 incremental updates in PostgreSQL, and Hocuspocus decides it is time to consolidate them for S3 cold storage, calling `Y.applyUpdate` in a loop will completely block the Node.js main thread. 

For the hundreds of milliseconds (or seconds) it takes to crunch that CRDT graph, your server cannot process incoming WebSocket frames. Ping/pong heartbeats will time out, causing mass disconnects for *every other active user on that server instance*.

**Concrete Mechanism:** Hocuspocus does not thread this out-of-the-box. To implement Pg/S3 tiering safely, OpenDesk must offload all CRDT compaction to Node's `worker_threads`. You must pass the binary update arrays to a worker, execute the Yjs merge, and return the compacted binary blob asynchronously. 

**Testable Hypothesis:** Inject 100,000 granular character edits into a Hocuspocus server, trigger the `onStoreDocument` hook natively, and measure event loop lag using Node's `perf_hooks`. Then, implement the Worker thread pattern and verify the main loop remains unblocked.

### 2. The Flat `Y.Map` Trap: Rich Text Inside Cells

Gemini's proposal to use a single Flat `Y.Map` with primitive strings for Phase 2 spreadsheets solves the memory issue but creates a catastrophic UX degradation. 

If the value of `R1C1` is a primitive string, Yjs resolves concurrent edits using Last-Write-Wins (LWW). If User A types "Q3 Revenue" and User B concurrently types "Projected Q3", one user's keystrokes will instantly obliterate the other's. You have lost the defining feature of collaborative software: character-by-character intent preservation. Modern users expect collaborative text *inside* the active cell.

**The Hybrid Pointer Architecture:** 
To maintain linear memory scaling while allowing intra-cell collaboration, OpenDesk must decouple the grid structure from the rich cell data:
1.  **The Grid:** A flat `Y.Map` mapping coordinates (`R1C1`) to either primitives (for simple numbers/booleans) or **unique ID strings**.
2.  **The Text Pool:** A separate top-level `Y.Map` mapping those unique IDs to `Y.XmlText` or `Y.XmlFragment` instances.

When a user focuses a cell to edit its text, the client checks the Text Pool. If an active `Y.XmlText` exists for that cell ID, it binds a miniature ProseMirror/CodeMirror instance directly to it. This grants character-level CRDT resolution inside the cell without bloating the 10,000 empty/primitive cells with `Y.Type` wrappers.

### 3. Solving the Validation "Flicker" Using Yjs Origins

Gemini noted that server-side counter-operations (to revert malicious or invalid edits) will cause a UX flicker, suggesting complex optimistic local validation is required. This is avoidable using Yjs's built-in `origin` tracking.

When TipTap/ProseMirror generates a local transaction, Yjs allows you to tag the resulting update with an `origin` (usually the local client ID).
Instead of writing complex validation rules in the client, you can:
1.  Tag local structural mutations as "pending_server_ack".
2.  Visually decorate these elements in ProseMirror (e.g., a subtle loading state or locked state) preventing further child edits.
3.  When the server applies the change, validates it, and echoes back its updated state vector, the client clears the "pending" decoration.
4.  If the server issues a counter-operation, the client simply accepts the Yjs revert, which cleanly replaces the decorated node.

This shifts the complexity from duplicating business logic on the client/server to simply managing UI decoration states via ProseMirror's transaction lifecycle.

### Net Conclusion

The architectural mandate is set: Yjs and Hocuspocus. But to survive production, OpenDesk must immediately implement:
1.  **Threaded CRDT Compaction:** Never run `Y.applyUpdate` on the Node.js main thread.
2.  **Hybrid Grid Schema:** Use a Flat `Y.Map` for coordinates, but separate `Y.XmlText` pools for complex cell contents.
3.  **Origin-Based Validation UI:** Let the server be the strict authority, but use ProseMirror decorations to mask the eventual consistency latency.

---

## DeepSeek (2026-04-06T20:17:18.154Z)

## Building on the cell-level collaboration crisis

Gemini’s hybrid pointer architecture reveals the true Phase 2 challenge: **coordinating transitions between cell value types** without losing collaboration semantics.

The split-brain editing problem Gemini identifies is real, but the proposed two-phase protocol violates real-time collaboration expectations. If User B must wait for User A's grid map update (step 2), you've introduced lock contention that defeats CRDT's purpose.

**Better mechanism: Use Yjs's type system to embed collaboration state directly in the cell pointer:**
- Each cell entry becomes either:
  1. `{type: "primitive", value: "123"}`
  2. `{type: "rich-text", docId: "uuid", version: stateVector}`
- When a client begins editing a primitive cell, it atomically swaps to type 2 via Yjs transaction
- Concurrent swaps resolve via deterministic rules (client ID ordering)
- The "losing" client's local edits merge into the now-shared rich text object

This maintains real-time semantics while avoiding split-brain.

## The operational crisis: Document healing after network failures

Everyone has missed **how Yjs handles document corruption during network outages**. Unlike Automerge's immutable change log that can be replayed from any point, Yjs's binary deltas are state-vector-relative. If a client disconnects mid-update and the server crashes before persisting, you can reach an unrecoverable state.

**Concrete failure mode:**
1. Client C at state vector V₀ sends update U₁
2. Server receives U₁, broadcasts to others, but crashes before persisting to PostgreSQL
3. On restart, server loads older snapshot V₀ from S3
4. Client C reconnects with state vector V₁ - but server has no record of U₁
5. Server cannot compute diff between V₀ and V₁

**Testable hypothesis:** Simulate this with Hocuspocus + PostgreSQL using `kill -9` during sync. Measure recovery rate. I predict <50% without custom reconciliation logic.

**Mitigation:** Implement a **Yjs operation journal** alongside snapshots. Every applied update gets logged with its state vector before broadcasting. On crash recovery, replay the journal against the last known good snapshot.

## The licensing trap: AGPL-3.0 and transitive dependencies

We've overlooked that **Hocuspocus's MIT license may not protect OpenDesk's AGPL-3.0 compliance** if underlying Yjs components have conflicting licenses.

Check: `y-protocols/awareness` (MIT), `y-websocket` (MIT), `lib0` (MIT). All compatible. But the risk is **transitive** through ProseMirror ecosystem.

**Concrete audit needed:** 
- Does `y-prosemirror` bundle any GPL-incompatible code?
- Does TipTap's collaboration extension introduce dependencies that would force OpenDesk to disclose proprietary modifications?

For an MVP focused on self-hosting, this is critical path. Automerge's Apache 2.0 license is simpler but irrelevant given the integration gap.

## Final synthesis: The validation crisis is the real blocker

The conversation has correctly converged on Yjs but undersold the **client-side validation burden**. Even with origin tracking and server counter-operations, OpenDesk must ensure TipTap schema invariants (node nesting, mark validity) hold after every merge.

**Novel mechanism: ProseMirror transaction filtering via Yjs observe**
```
doc.on('update', (update, origin) => {
  const pmState = yProsemirror.getState()
  const tr = pmState.tr
  // Apply Yjs changes as ProseMirror transaction steps
  // Before applying, run schema.checkTransaction(tr)
  // If invalid, compute corrective transaction and apply with new origin
})
```
This moves validation into the merge loop itself, catching violations before they hit the DOM.

**Recommendation order:**
1. License audit of Yjs ecosystem
2. Implement operation journal for crash recovery
3. Build cell type transition protocol before spreadsheet prototype
4. Deploy adversarial network tests immediately

The hardest problem isn't which CRDT, but **maintaining ProseMirror schema validity under arbitrary merge outcomes**. That's where OpenDesk's innovation will actually matter.

---

## Mistral (2026-04-06T20:17:18.338Z)

[No response - authentication error]

---

> **Moderator**: ## Structured Summary

## Key Findings

- **Yjs is the clear Phase 1 choice**: TipTap's team maintains `@tiptap/extension-collaboration` and Hocuspocus on top of Yjs; `y-prosemirror` provides a battle-tested `Y.XmlFragment` ↔ ProseMirror binding, `Y.UndoManager` solves collaborative undo out-of-the-box, and `y-protocols/awareness` handles cursor/presence as a first-class primitive — none of these have Automerge equivalents.
- **Automerge's Peritext semantics are theoretically superior for mark conflicts** (bold-boundary expansion under concurrent edits), but the implementation is newer than `y-prosemirror` and requires a fully custom ProseMirror binding — making it impractical for Phase 1.
- **Phase 2 spreadsheet schema must use a flat `Y.Map` (coordinate keys → primitives/IDs) with a separate `Y.XmlText` pool** for cells requiring intra-cell rich text collaboration; naively nesting `Y.Map` per cell would cause prohibitive overhead, but a flat map with primitives alone sacrifices character-level merge semantics.
- **CRDT compaction (`Y.applyUpdate`) is synchronous and CPU-bound** — running it on the Node.js main thread during Hocuspocus's `onStoreDocument` hook will block the event loop and cause mass WebSocket disconnections; compaction must be offloaded to `worker_threads`.
- **Safe Pg (hot) / S3 (cold) tiering requires co-persisting the minimum state vector alongside each snapshot**; restoring a snapshot without its state vector makes it impossible to reconstruct diffs for stale-reconnecting clients, and crash recovery requires a separately maintained Yjs operation journal.

---

## Confidence Levels

- **HIGH**: Yjs + Hocuspocus + `y-prosemirror` is the correct Phase 1 stack; licensing (Yjs MIT, Hocuspocus MIT, `y-protocols` MIT) is clean under AGPL-3.0; `Y.UndoManager` solves collaborative undo; Automerge has no viable ProseMirror binding.
- **HIGH**: Formula range-shifting under concurrent structural mutations (row insert + concurrent formula creation) is an **application-layer problem above the CRDT**, not a property of either library — neither Yjs nor Automerge understands range references; a stable cell-ID scheme (not positional) is required regardless of CRDT choice.
- **MEDIUM**: The flat `Y.Map` + `Y.XmlText` pool hybrid architecture for Phase 2 spreadsheets is sound in theory but **untested at scale**; the atomic cell-type transition protocol (primitive → rich-text swap via Yjs transaction with deterministic conflict resolution) is plausible but unvalidated.
- **MEDIUM**: Yjs GC compaction blocks the Node.js event loop — the severity depends on document size and update frequency; the `worker_threads` mitigation is architecturally correct but adds non-trivial implementation complexity.
- **LOW**: Automerge's immutable change log providing cleaner crash recovery semantics than Yjs's state-vector-relative deltas — true in principle, but moot given the Phase 1 integration gap; Automerge's self-hosted Node.js story (no PostgreSQL adapter, WASM overhead on ARM) remains unvalidated in practice.

---

## Open Questions

- Does `y-prosemirror`'s mark conflict behavior (non-Peritext LWW semantics) produce perceptible UX failures under realistic concurrent bold/italic editing — i.e., does the Peritext gap matter in practice?
- What is the actual Node.js event loop lag when consolidating a heavily-edited Yjs document (e.g., 50k–100k incremental updates) synchronously, and does `worker_threads` offloading introduce unacceptable complexity for an MVP?
- Can the server-side counter-operation pattern (detect invalid edit → emit corrective operation) be executed with latency low enough (<100ms round-trip) to avoid perceptible UX flicker, or does it require client-side optimistic schema validation?
- What is the correct atomic protocol for transitioning a Yjs cell entry from primitive to `Y.XmlText` under concurrent edits without introducing split-brain states or lock contention?
- Does a crash-between-broadcast-and-persist scenario in Hocuspocus produce an unrecoverable Yjs state, and what is the observed recovery rate without an explicit operation journal?

---

## Suggested Follow-ups

1. **Adversarial test suite for `y-prosemirror` mark semantics**: Implement a focused test harness covering concurrent bold-insert-during-mark-delete, concurrent formatting boundary manipulation, and network-partition recovery — this is the single highest-value validation before committing to Yjs for Phase 1 rich text.
2. **Phase 2 spreadsheet schema prototype and benchmarks**: Build a minimal proof-of-concept with the flat `Y.Map` + `Y.XmlText` pool hybrid at 100k cells with 1k concurrent simulated edits; measure heap size, `encodeStateAsUpdate` payload size, and event loop lag — this directly validates or invalidates the Phase 2 architecture before any production investment.
3. **Hocuspocus crash-recovery and GC state vector implementation design**: Spec out the operation journal schema, the state vector floor check on client reconnect, and the `worker_threads` compaction architecture as a concrete engineering design document — this is the highest-risk operational gap identified and needs a validated implementation plan before Phase 1 launch.

---

## Verdict

This topic is sufficiently explored at the conceptual and architectural level to commit to Yjs for Phase 1, but **requires one additional targeted session** focused specifically on the crash-recovery/GC state vector mechanics and the `worker_threads` compaction pattern, as these represent unresolved production-readiness risks that could block a stable Phase 1 launch.

