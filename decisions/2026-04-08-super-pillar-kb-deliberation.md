# AI Deliberation: Research: OpenDesk is restructuring its roadmap from 8 flat pillars into super-pillars (product lines) + cross-cutting pillars. The super-pillars are: Documents (word processor, ~95% done), Sheets (spreadsheet, ~15% done), Slides (presentation, ~10% done), and a new one: Knowledge Base (KB). The KB is a place where information lives SEPARATE from its presentation — facts, references, datasets, glossary entries, research notes — that can be pulled into any document type (footnotes, cell references, slide citations). The existing Pillar 7 (Reference & Citation Management, ~90% done) would fold INTO the KB super-pillar as its first completed milestone. Key questions: (1) What should the KB super-pillar encompass beyond references? (2) How should the KB relate to Documents/Sheets/Slides (uni-directional pull, bi-directional sync, or something else)? (3) What are the sovereignty implications of a centralized knowledge store? (4) How does this interact with Pillar 1 (Local AI/BYOM) — the KB seems like the natural corpus for RAG. (5) What's the right data model — structured records, wiki pages, or a graph? Context: OpenDesk is a sovereign, AGPL-3.0 office suite for Canadian/EU organizations. All data stays on-premise. The cross-cutting pillars (AI, audit, erasure, workflows, federation, observability) apply to ALL super-pillars including the KB.

*Started: 2026-04-08T14:02:53.476Z*

## System Prompt

You are participating in a focused research session.

**Research Topic**: OpenDesk is restructuring its roadmap from 8 flat pillars into super-pillars (product lines) + cross-cutting pillars. The super-pillars are: Documents (word processor, ~95% done), Sheets (spreadsheet, ~15% done), Slides (presentation, ~10% done), and a new one: Knowledge Base (KB). The KB is a place where information lives SEPARATE from its presentation — facts, references, datasets, glossary entries, research notes — that can be pulled into any document type (footnotes, cell references, slide citations). The existing Pillar 7 (Reference & Citation Management, ~90% done) would fold INTO the KB super-pillar as its first completed milestone. Key questions: (1) What should the KB super-pillar encompass beyond references? (2) How should the KB relate to Documents/Sheets/Slides (uni-directional pull, bi-directional sync, or something else)? (3) What are the sovereignty implications of a centralized knowledge store? (4) How does this interact with Pillar 1 (Local AI/BYOM) — the KB seems like the natural corpus for RAG. (5) What's the right data model — structured records, wiki pages, or a graph? Context: OpenDesk is a sovereign, AGPL-3.0 office suite for Canadian/EU organizations. All data stays on-premise. The cross-cutting pillars (AI, audit, erasure, workflows, federation, observability) apply to ALL super-pillars including the KB.



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


> **Moderator**: The central question before us is whether a sovereign Knowledge Base — a structured, on-premise store of facts, references, and datasets decoupled from any single document type — can serve as the connective tissue that gives OpenDesk's four product lines coherent meaning rather than merely coexistence. To answer that, we need to probe three tightly linked sub-questions: first, what data model (structured records, wiki-style pages, or a property graph) best preserves the KB's neutrality while remaining queryable across Documents, Sheets, and Slides without creating hidden coupling; second, how Pillar 1's local AI layer should treat the KB as a RAG corpus without compromising the erasure and audit guarantees that sovereignty-conscious organizations require; and third, whether the relationship between the KB and consuming document types should be a strict uni-directional pull — preserving the KB as a single source of truth — or a richer bi-directional sync that risks turning every document into an uncontrolled write path into shared knowledge. The tension between expressive power and governance discipline runs through all three, and resolving it will define not just the KB's architecture but the character of OpenDesk as a platform.


## Claude (2026-04-08T14:04:14.726Z)

## On the Data Model: The Schema Evolution Problem Is the Real Risk

The structured/wiki/graph trichotomy is less important than a question the framing glosses over: **what is the unit of identity, and can it survive ontology change?**

A property graph gives maximum expressive power but creates a fragility: when an organization reclassifies a relationship type (say, `CITES` becomes `CITES_NORMATIVELY` vs `CITES_INFORMALLY`), all consuming documents holding edges of the old type face a migration problem with no clean rollback. Wiki pages avoid this but sacrifice queryability. Structured records are too rigid for heterogeneous knowledge types.

The concrete proposal: a **three-layer entry model**:

```
Core:     { id: stable-UUID, content_type, canonical_text, created_at, version }
Semantic: optional RDF-style triples linking entries (graph overlay, not the base)
Surface:  rendered markdown/prose for human consumption
```

The key discipline is that **cross-document references bind to the Core ID only**, never to semantic layer predicates. The graph is queryable enrichment; it's not the load-bearing structure. This lets the ontology evolve without invalidating citation anchors.

---

## On RAG + Erasure: The Cascade Problem Is Real and Underspecified

Erasure (GDPR Art. 17, PIPEDA s.11) applied to a RAG corpus creates a genuine unsolved problem that deserves more rigor than "delete the embedding."

The actual cascade:
1. KB entry is erased → its embedding must be purged
2. But that embedding may have contributed to a generated summary stored in a Document
3. Does that Document fragment require erasure? The law's answer is probably yes if the entry contained personal data

Vector indices (FAISS, pgvector) don't support efficient single-vector deletion — the standard approach is full index rebuild, which is operationally untenable at scale.

**Proposed mechanism: segment-isolated embedding namespaces.** Each KB entry owns its embedding shard. The RAG query layer treats the KB as a collection of independently tombstonable segments. On erasure:

- Shard is tombstoned immediately (queries skip it, latency impact negligible)
- Background job rebuilds only the affected shard, not the whole index
- Audit record: `{entry_id, erasure_ts, embedding_ids_purged, document_ids_that_cited_entry}`
- Citing documents receive a `stale_citation` flag — their owners must decide whether to revise or acknowledge the gap

The audit trail must record **which KB entry IDs contributed to each RAG inference**, not raw vectors. This makes the erasure audit tractable and legally defensible. The inference log is the accountability artifact, not the vector space itself.

---

## On Pull vs. Sync: The Ossification Failure Mode

Pure uni-directional pull has a failure mode the framing doesn't name: **knowledge ossification**. Knowledge is generated *through* document work — a researcher finds a fact while writing, an analyst corrects a figure in a sheet. If the only write path to KB is an explicit separate action, friction ensures the KB stagnates while documents accumulate shadow knowledge that never gets promoted.

**Curated promotion with attribution** resolves this without opening uncontrolled write paths:

- Documents/Sheets/Slides → KB is a *proposal* action, not a write. It creates a `Draft` entry with full provenance: `{source_doc_id, author, timestamp, excerpt}`
- KB entries have a lifecycle: `Draft → Reviewed → Published → Deprecated`
- Only `Published` entries are available for RAG and cross-document citation
- The `Reviewed → Published` gate is where a human (or an authorized workflow) makes knowledge "official"

This preserves the KB as source of truth while acknowledging that truth emerges from document work. The governance step is the sovereignty-respecting bottleneck.

---

## The Hardest Unsolved Sub-Problem: Version Pinning vs. Living References

Neither the pull nor the sync framing addresses what I think is the *genuinely hardest* problem: **what version of a KB entry does a consuming document hold?**

Consider two real cases:
- A contract document cites a regulatory definition entry — it must **not** silently update if the definition changes post-signing
- A slide deck cites current organizational headcount — it *should* reflect live data

These require two distinct reference semantics that the KB must expose as first-class concepts:

| Mode | Semantics | Consumer declares |
|------|-----------|-------------------|
| **Versioned** | Consumer pins to a specific entry version at cite time | `kb://entry-uuid@v7` |
| **Mutable** | Consumer always resolves to current published version | `kb://entry-uuid@latest` |

The KB must track version history (append-only log per entry), and consuming applications must declare which mode they're using at the time of reference insertion. This isn't just a nice-to-have — it's a **legal audit requirement** for organizations producing regulatory filings or contracts. A document's meaning must be reconstructible from its KB reference pins at any past point in time.

---

## Federation Implication

One structural observation: if OpenDesk instances federate (a Canadian provincial government sharing KB entries with municipalities), KB entries need **globally resolvable identifiers**, not just local UUIDs. The pattern is closer to DOIs than to database primary keys. Per-entry access control lists (not KB-level ACLs) become necessary because the same entry may be `public` to federated peers but `restricted` internally for some fields. This argues for an entry model that supports field-level visibility flags from day one, not as a retrofit.

---

## Gemini (2026-04-08T14:04:14.733Z)

[No response - spawn gemini ENOENT]

---

## DeepSeek (2026-04-08T14:04:44.689Z)

Building on Claude’s version-pinning insight—that’s essential—but the deeper unsolved problem is **reference integrity under entry decomposition or merging**. If a KB entry is split (e.g., a monolithic “project report” entry becomes three separate entries for data, methodology, and conclusions), what happens to existing `@v7` pins in contracts? The system must support **redirects with provenance**, not just versioning. This suggests each entry needs a persistent, immutable logical ID that can map to one or more physical records over time, with an auditable mapping log.

On data model: I agree the graph should be an overlay, but the real trade-off is between **query expressiveness and sovereignty compliance**. A property graph allows rich relationships (e.g., “conflictsWith,” “derivedFrom”), but those edges themselves may contain legally sensitive context. If an edge is erased, how do we reify the “hole” in the graph for audit purposes? I propose each edge is a first-class KB entry with its own ID, lifecycle, and erasure trail—making the graph a collection of nodes and relation-entries. This adds overhead but makes governance tractable.

For RAG: Claude’s sharding approach is clever, but the harder problem is **explainability in cross-entry inferences**. If a RAG response is synthesized from three KB entries and local context, the audit log must capture not just the entry IDs, but the *weighted contribution* of each to the output—a requirement for contestability under EU AI Act. This may require logging attention weights or similarity scores alongside citations.

On pull vs. sync: The curated promotion model is right, but we should also support **automated provenance tagging** from Sheets. For example, a cell range published as a KB dataset should carry a formula lineage (e.g., “this range = SheetX!A1:B10 filtered by Y”). If the sheet changes, the KB entry doesn’t auto-update, but it can flag “source data has diverged” and propose an update draft.

Lastly, a novel angle: the KB should serve as **OpenDesk’s internal schema registry**. Document templates, slide masters, and sheet data validation rules could be stored as KB entries—versioned, citeable, and federatable. This turns style governance into a knowledge-management problem, aligning with sovereignty goals (e.g., ensuring only approved templates are used in official reports).

---

## Mistral (2026-04-08T14:04:44.929Z)

[No response - authentication error]

---

## Claude (2026-04-08T14:05:48.417Z)

## Pushing Back on Attention Weights as Contestability Evidence

DeepSeek's proposal to log attention weights for EU AI Act contestability is technically wrong and needs correction before it gets baked into the architecture.

Attention weights are a computational artifact of the transformer forward pass — they measure query-key similarity in embedding space, not semantic contribution to a claim. A high attention weight on a KB entry doesn't mean that entry *caused* the generated statement; it means it was geometrically proximate in a high-dimensional space during that inference pass. This won't survive legal scrutiny and may actively mislead contestability review.

The correct mechanism is **inference-time citation forcing via constrained generation**: rather than logging what the model attended to, require that every factual claim in a RAG response be grounded by an explicit citation tag emitted by the model itself, then validate that tag against the retrieved entry set. The audit record becomes:

```
{
  claim_text: "...",
  asserted_kb_entry: "kb://uuid@v7",
  retrieved_entry_ids: [...],
  claim_in_retrieved: true/false,
  model_confidence: 0.87
}
```

If `claim_in_retrieved` is false, the response is flagged as a hallucination and quarantined before delivery. This makes contestability tractable without depending on attention internals. It also gives the erasure pipeline a clean target: if `asserted_kb_entry` is erased, the downstream inference record is marked stale.

---

## The Snapshot Problem: Temporal Coherence Across a Document Set

Version pinning at the individual citation level (Claude's `@v7` / `@latest` modes) is necessary but insufficient. Sovereign organizations produce **compound regulatory artifacts** — a filing that consists of a Document (cover narrative), multiple Sheets (underlying data), and a Slides deck (summary presentation). All three must cite KB entries as of the same logical moment, or the filing is internally inconsistent.

This is a distributed snapshot problem that nobody has addressed. The proposed fix:

**KB Snapshot Sets** — a first-class KB concept representing an immutable, timestamped slice of all published entry versions at a given instant:

```
snapshot_id: UUID
captured_at: ISO-8601 timestamp
entry_versions: { entry_uuid → version_number, ... }
captured_by: user/workflow-id
purpose: "Q4-2025 regulatory filing"
```

A document set declares itself as bound to a snapshot ID at filing time. All `@latest` references within that set are resolved against the snapshot, not against the live KB. The snapshot is append-only, signed, and cannot be deleted — only deprecated with a supersession pointer.

This is closer to how version control works for source code releases than to how citation managers work, and that's the right mental model. The alternative — trusting that all `@latest` references in three separate documents happen to resolve to the same version at audit time — is not a governance posture, it's a hope.

---

## The Reverse Dependency Registry Is Load-Bearing, Not Optional

Both the erasure cascade analysis and the snapshot problem reveal a requirement that's implicit but unspecified: the KB needs a **reverse dependency registry** mapping each entry to its dependents.

Without it:
- You cannot identify which documents need `stale_citation` flags on erasure (Claude raised this but didn't specify the mechanism)
- You cannot warn KB maintainers before they publish a breaking change to a `Published` entry that contracts are pinned to
- You cannot build the snapshot faithfully — you don't know which entries are "live" in which document sets

The registry looks like:

```
entry_uuid → [
  { consumer_id, consumer_type (doc/sheet/slide/snapshot), ref_mode (versioned/mutable), pinned_version }
]
```

This is the **write path for the pull model**: when a document inserts a KB citation, it registers its dependency. This makes the "uni-directional pull" claim precise — documents cannot write KB content, but they do write to the dependency registry, which is a separate, operationally critical subsystem.

The practical implication: deleting a `Published` KB entry with active dependents should require explicit override by an authorized workflow, not be a silent operation. The registry makes this enforceable.

---

## Negative Knowledge as First-Class Entries

This is speculative but testable: sovereign organizations frequently need to assert *explicit uncertainty or absence of knowledge*, not just positive facts. A pharmacovigilance database needs to say "interaction between compound X and compound Y: **UNKNOWN — as of 2024-03 review**" as a positive assertion, because the absence of an entry is epistemically ambiguous (unknown, or just not yet catalogued?).

The KB entry model should support a `knowledge_status` field: `{established, contested, unknown, retracted}`. RAG queries should treat `unknown` and `retracted` entries differently from `established` — surfacing them as constraints on what the model can assert, not as positive evidence. This prevents the AI layer from silently treating "we reviewed this and found nothing conclusive" as equivalent to "this topic is absent from the KB."

---

## Challenge: Schema Registry Should Be Partitioned Out of RAG Corpus

DeepSeek's idea of using KB entries for document templates and validation rules is operationally attractive but creates a contamination problem: if operational schema metadata enters the RAG corpus alongside substantive knowledge, the local AI layer will hallucinate schema details into answers to content questions. "What does the policy say about X?" should not return results influenced by the fact that the invoice template uses a particular field validation rule.

The KB needs an explicit **corpus partition** declared at the entry level: `{knowledge, operational, reference}`. Only `knowledge` and `reference` partitions are available to RAG. `operational` entries (templates, validation schemas, style masters) are queryable by the document applications directly but excluded from AI inference. This partition should be enforced at the retrieval layer, not at the application layer — otherwise every consuming application has to implement the exclusion logic independently and will eventually get it wrong.

---

## DeepSeek (2026-04-08T14:06:11.864Z)

Claude’s snapshot concept is correct for single-instance coherence, but it fails under **federation** where each sovereign instance controls its own timeline. If Instance A shares a KB entry with Instance B, and Instance A later publishes a breaking change, Instance B’s snapshots must not auto-update—yet B may still want to receive corrections for critical errors. This requires **snapshot inheritance with explicit pull**: a snapshot can declare its upstream source snapshot ID and a diff of locally overridden entries. Governance then becomes managing divergence from shared knowledge, not just internal consistency.

DeepSeek’s redirects are necessary, but for sovereignty, redirects must be **locally overrideable**. If Entry E is split into E1 and E2 in the upstream KB, a downstream instance must be able to retain the original E as a frozen copy for its pinned documents, while optionally mapping new docs to the split structure. This suggests a two-tier graph: a local, immutable knowledge graph for pinned references, and a live graph for mutable references—with a diff layer between them.

On the reverse dependency registry: scaling this to federated snapshots requires **registry sharding by snapshot ID**. Otherwise, the registry becomes a monolithic bottleneck. Each snapshot should carry its own compact dependency map, built when the snapshot is created. This allows garbage collection of stale references and keeps the live registry manageable.

One novel angle: the KB should support **document swarms**—a first-class entity grouping a Document, its linked Sheets, Slides, and a specific KB snapshot. This swarm becomes the unit of archival, signing, and erasure. When an entry is erased, the system identifies affected swarms via the snapshot-bound registry and flags the entire swarm for review, not just isolated documents. This mirrors real-world regulatory workflows where a filing is a cohesive bundle, not loose documents.

Finally, a testable hypothesis: **partition-specific RAG guardrails** will reduce hallucination more effectively than citation forcing alone. By restricting RAG retrieval to entries with `knowledge_status=established` and `corpus=knowledge`, and requiring explicit inclusion of `contested` or `unknown` entries only when the query contains uncertainty signals (e.g., “what is debated about X?”), we can align AI outputs with organizational epistemic policies. This can be A/B tested against a baseline of unfiltered retrieval.

---

## Mistral (2026-04-08T14:06:12.072Z)

[No response - authentication error]

---

## Claude (2026-04-08T14:07:39.296Z)

## Challenging Swarms as the Erasure Unit

The document swarm concept is right for archival and signing — wrong for erasure. Swarms group by *provenance* (co-created artifacts), but erasure rights attach to *data subjects*. A GDPR Art. 17 request for person P may affect KB entries distributed across dozens of swarms with no common creation context. The swarm gives you no help finding them; only the reverse dependency registry does. Conflating archival granularity with erasure granularity will produce a system that's clean for auditors reviewing filings but broken for DPO workflows.

Concrete correction: the reverse dependency registry should index entries by **data subject tag** in addition to consumer ID. The swarm remains the unit for signing and archival integrity. Erasure follows the data subject graph, not the swarm boundary.

---

## The Query Contract Is a Sovereignty Requirement, Not an API Detail

Nobody has addressed what query interface the KB exposes to consuming applications. This is load-bearing and has a sovereignty dimension that's easy to miss.

If Documents, Sheets, and Slides query the KB through its internal representation — directly hitting a triple store, a graph API, a pgvector namespace — then the internal data model *becomes* the public API. That means any future migration (PostgreSQL → different backend, graph format change, embedding model upgrade) requires coordinated changes across all consuming applications. You've recreated the coupling the KB was supposed to eliminate, just at a different layer.

The KB must expose a **stable, versioned, representation-agnostic query contract**:

```
GET /kb/entries/search
  ?q=<text>              # full-text
  &semantic=true         # invoke embedding similarity
  &corpus=knowledge      # enforce partition
  &jurisdiction=CA-QC    # scope to jurisdiction (see below)
  &as_of=snapshot-uuid   # resolve against snapshot, not live

→ [{ entry_id, version, canonical_text, knowledge_status, match_score }]
```

The backend can be anything; the contract is stable. This is also the enforcement layer for corpus partitioning and jurisdiction scoping — implemented once, correctly, not reimplemented in each consuming application. Critically, this abstraction is what makes the KB migratable without organizational disruption, which is the operational definition of sovereignty for a self-hosted system.

---

## Jurisdiction-Scoped Truth: The Real Federation Conflict Problem

DeepSeek raised federation divergence but framed it as a version conflict. That's the easy case. The harder case is **jurisdictional fact divergence** — two instances holding contradictory `established` facts that are *both correct* in their respective legal contexts.

Example: "mandatory data retention period for financial records" is 7 years under Canadian federal rules, 10 years under certain provincial regimes, and varies across EU member states. These aren't merge conflicts. They're legitimately different facts scoped to different legal contexts. If Instance A (federal Crown agency) federates with Instance B (Quebec provincial ministry), deduplication of this entry would be actively harmful.

The KB entry model needs a `jurisdiction` field as a first-class dimension:

```
{ entry_id, jurisdiction: ["CA-QC", "CA"], knowledge_status, canonical_text, ... }
```

Federation queries must scope to jurisdiction before asserting conflicts. Two entries are candidates for conflict detection only if their jurisdiction sets *overlap*. Entries with disjoint jurisdictions are not in conflict — they're parallel truths. The query contract's `jurisdiction` parameter enforces this at retrieval time.

The practical implication: the federation sync protocol should never auto-merge entries based on semantic similarity alone. It should surface candidate pairs with overlapping jurisdictions for human review, annotated with their jurisdiction scopes. This is contestable, auditable, and avoids the silent epistemic drift that uncontrolled federation creates.

---

## Freshness Signaling: A Missing Display Contract

Version pinning covers the *legal* case (contracts must not silently update). But mutable `@latest` references have an unremarked failure mode in the *presentation* case: a Slides deck with `@latest` headcount data is rendered 8 months after creation. The number on screen may be materially outdated. The presenter has no signal.

The KB must provide a **freshness metadata** field on resolved references:

```
{
  entry_id, version, canonical_text,
  resolved_at: <query timestamp>,
  entry_last_modified: <timestamp>,
  staleness_threshold: "P30D"   # declared by entry maintainer
}
```

Consuming applications use `staleness_threshold` to decide whether to display a freshness warning. The threshold is declared by the KB entry's maintainer — a live regulatory tariff might have `P1D`, a glossary definition might have `P365D`. This is a **display-layer contract** between KB and consumers, not a governance policy — it informs without blocking.

The entry maintainer setting the threshold is also accountability-creating: if they declare `P30D` and don't update the entry, the KB surfaces that as an overdue review, not silently. Combined with the reverse dependency registry, the KB can notify maintainers: "Entry X has been resolved 47 times this month against `@latest` and is 12 days past its declared staleness threshold."

---

## The Cold Start Problem: Pillar 7 Migration Path

One concrete, near-term issue the architecture discussion hasn't touched: Pillar 7 (Reference & Citation Management) is ~90% complete. There are existing reference structures, likely BibTeX-compatible or similar. Migrating these into the Core/Semantic/Surface model requires answering a question that affects everything downstream:

**What is `canonical_text` for a reference entry?** Options:
- The formatted citation string (human-readable but format-dependent)
- The abstract/summary (informative but not canonical)
- A structured record serialized to text (machine-reliable but not human-natural)

The recommendation: `canonical_text` for migrated reference entries should be the **structured record serialized as human-readable prose** — e.g., "Smith, J. (2023). *Title*. Journal, vol. 4. DOI: 10.xxxx" — with the structured fields preserved in the Semantic layer as typed predicates (`author`, `doi`, `publication_date`, etc.). The DOI becomes the external anchor for federation identity — it's already a globally resolvable identifier, which solves the federation entity identity problem for the reference subset of KB entries without inventing a new scheme.

This migration is also the first concrete test of the `knowledge_status` lifecycle: all migrated Pillar 7 entries should enter as `established` (they've already been curated), bypassing the `Draft → Reviewed` workflow, but with a migration provenance tag so the review gate isn't silently circumvented for future entries.

---
