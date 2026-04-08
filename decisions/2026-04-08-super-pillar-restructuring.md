# Decision #011: Super-Pillar Restructuring & Knowledge Base

**Date:** 2026-04-08
**Status:** Accepted
**Context:** As OpenDesk matures beyond its document editor MVP, the original 8-pillar roadmap structure (Pillar 0–7) conflates two distinct concerns: **product lines** (what users interact with) and **cross-cutting capabilities** (what makes the platform sovereign). Spreadsheet and presentation editors were listed as "Phase 2/3" afterthoughts rather than first-class strategic tracks. Additionally, a new concept has emerged: a Knowledge Base that separates information from its presentation.

This decision restructures the roadmap into **super-pillars** (product lines) and **cross-cutting pillars** (platform capabilities), and introduces the Knowledge Base as a fourth super-pillar.

## Problem

The flat pillar model has three issues:

1. **Spreadsheets and presentations are buried.** They appear as MVP phases, not strategic pillars. They have no milestones, no ownership model, no clear scope boundary. Yet they are entire product lines with their own competitive landscapes.

2. **Cross-cutting concerns are tangled with product lines.** Pillar 0 (Editor Foundation) is a product line. Pillar 2 (Crypto Audit) is a platform capability. They live at the same level in the hierarchy despite being fundamentally different kinds of work.

3. **No concept of shared knowledge.** Pillar 7 (References) hinted at this — a library of facts that lives outside any single document — but it was scoped narrowly to citations. Users need a place where organizational knowledge *lives*, independent of how it's presented in documents, spreadsheets, or slides.

## Decision

### Structure: Super-Pillars + Cross-Cutting Pillars

**Super-Pillars** are product lines. Each has its own editor, data model, UI, milestones, and competitive landscape:

| Super-Pillar | Description | Status |
|---|---|---|
| **Documents** | Word processor (TipTap + Yjs) | ~95% of MVP |
| **Sheets** | Spreadsheet editor | ~25% (formula engine landed) |
| **Slides** | Presentation editor | ~20% (element interaction landed) |
| **Knowledge Base** | Structured information store | ~40% (typed entries, relationships, search landed) |

**Cross-Cutting Pillars** are platform capabilities that apply to ALL super-pillars:

| Pillar | Name | Applies To |
|---|---|---|
| C1 | Air-Gapped Local AI (BYOM) | All — KB is primary RAG corpus |
| C2 | Cryptographic Audit & e-Discovery | All — every mutation is auditable |
| C3 | Verifiable Data Erasure | All — CRDT pruning per doc type |
| C4 | Sovereign Workflows | All — triggers on any content type |
| C5 | Cross-Sovereign Federation | All — federate any content type |
| C6 | Observability & Compliance | All — unified dashboard across types |

**Pillar 7 (References)** is absorbed into the Knowledge Base super-pillar as its first completed milestone.

### The Shared Shell

A fifth concern that isn't a super-pillar but enables all of them: the **App Shell** — dashboard, navigation, type switching, theming, workspace management. Now implemented as a unified SPA with client-side routing, dynamic editor loading via ESM code splitting, and shared chrome (nav sidebar, top bar). Remaining work: offline mode via service workers, shared state persistence across views.

### Overlap Analysis

These concerns are shared across super-pillars and must be designed once, not per-product:

| Concern | Current State | Required Work |
|---|---|---|
| **Yjs collaboration** | Shared Hocuspocus server | Works for all types — different Y-types per editor |
| **Convert module** | Text-only (docx/odt/pdf) | Needs xlsx/ods/csv + pptx/odp branches |
| **AI text extraction** | document-extractor.ts (text only) | Needs extractors for cells, slides, KB entries |
| **Audit trail** | Event-driven, type-agnostic | Already works for new types if they emit events |
| **Auth/permissions** | Document-scoped grants | Needs extension to KB entries and libraries |
| **Search** | Full-text on documents | Needs cross-type search (docs + sheets + slides + KB) |
| **App shell** | SPA with client-side routing | Needs offline mode, shared state persistence |

## Knowledge Base: Concept

### What It Is

The Knowledge Base is where **information lives separate from its presentation**. A fact, reference, dataset, or definition exists in the KB. Documents, spreadsheets, and slides *reference* that information — they don't own it.

Think of it as the difference between:
- A citation in a footnote (presentation) vs. the bibliographic record (knowledge)
- A number in a cell (presentation) vs. the dataset it came from (knowledge)
- A definition on a slide (presentation) vs. the glossary entry (knowledge)

### What It Encompasses

1. **References** (already built, ~90%) — citations, bibliography entries, DOI records
2. **Entities** — people, organizations, projects, terms. A directory/glossary that any document can reference. When an entity is updated in the KB, every document referencing it can be notified.
3. **Datasets** — tabular data that lives independently of any spreadsheet. A spreadsheet *views* a dataset; the dataset persists even if the spreadsheet is deleted. Think: canonical data tables that multiple sheets can query.
4. **Notes & Clippings** — research fragments, excerpts, annotations. Collected from documents or entered directly. The raw material that feeds into polished documents.
5. **Relationships** — how entries connect. Person → Organization, Dataset → Source, Reference → Topic. A lightweight property graph over KB entries.

### Data Model

**Hybrid: typed records with optional relationships (property graph lite)**

Each KB entry is a typed record:
```
KBEntry {
  id: UUID
  workspace_id: UUID
  entry_type: 'reference' | 'entity' | 'dataset' | 'note' | 'glossary'
  schema_version: number
  title: string
  content: JSONB          -- type-specific structured data
  tags: string[]
  created_by: UUID
  created_at: timestamp
  updated_at: timestamp
}
```

Relationships are stored separately:
```
KBRelation {
  id: UUID
  source_id: UUID         -- FK to KBEntry
  target_id: UUID         -- FK to KBEntry or document/sheet/slide
  relation_type: string   -- 'cites', 'authored_by', 'source_of', 'defines', etc.
  metadata: JSONB
}
```

This avoids the complexity of a full graph database while enabling relationship queries via PostgreSQL. The existing `references` and `citations` tables map cleanly onto this model.

### Relationship to Other Super-Pillars

**Primarily uni-directional pull with opt-in promotion.**

- **Pull**: Documents, Sheets, and Slides pull from the KB via inline references (like the existing citation picker). The KB is the source of truth.
- **Promote**: Users can "promote" content from a document into the KB (e.g., select a paragraph → "Save to Knowledge Base as Note"). This is an explicit action, not automatic sync.
- **Live references**: When a KB entry changes, documents referencing it can display a "source updated" indicator. The user decides whether to accept the update. No silent mutation of published documents.

This avoids the governance nightmare of bi-directional sync while keeping the system useful.

### Sovereignty Implications

The KB is the highest-value target in a sovereign deployment:
- It concentrates institutional knowledge in one queryable store
- It's the natural RAG corpus for Pillar C1 (Local AI) — instead of embedding scattered documents, embed the curated KB
- It's the thing compliance officers audit most (Pillar C2)
- It's the thing GDPR erasure requests target (Pillar C3)
- It federates across instances (Pillar C5) — shared glossaries, cross-org reference libraries

A centralized knowledge store that lives on your infrastructure, queried by your local AI, auditable by your compliance team, erasable per your privacy policies — this is the sovereignty pitch distilled.

## Sequencing

```
Super-Pillars (Product Lines)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Documents ████████████████████░  ~95%  (continuous improvement)
KB        ████████░░░░░░░░░░░░  ~40%  (typed entries, relationships, search)
Sheets    █████░░░░░░░░░░░░░░░  ~25%  (formula engine landed)
Slides    ████░░░░░░░░░░░░░░░░  ~20%  (element interaction landed)

Cross-Cutting Pillars (apply to all super-pillars)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
C2 Audit        █████████████████░░░  ~85%
C1 Local AI     ██████████████░░░░░░  ~70%
C5 Federation   ███████████░░░░░░░░░  ~55%
C4 Workflows    ██████████░░░░░░░░░░  ~50%
C6 Observability█████████████░░░░░░░  ~65%
C3 Erasure      ████████░░░░░░░░░░░░  ~40%

App Shell (shared infrastructure)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard, navigation, type switching, theming
SPA shell with client-side routing and dynamic editor loading (landed)
Remaining: offline mode (service workers), shared state persistence
```

### Priority Order

1. **Documents** — continue hardening, it's the flagship
2. **Knowledge Base** — high leverage, references already done, enables AI corpus
3. **Sheets** — formula engine landed; next: formatting, multi-sheet, copy/paste
4. **Slides** — element interaction landed; next: element types, formatting, layouts

### Dependencies

- KB depends on Documents being solid (it references into docs)
- Sheets and Slides are independent of KB but benefit from it (dataset references, slide citations)
- Cross-cutting pillars should be validated against ALL super-pillars, not just Documents
- App Shell work becomes necessary when any two super-pillars are feature-complete enough for daily use

## Open Design Questions (from hivemind deliberation)

See `decisions/2026-04-08-super-pillar-kb-deliberation.md` for the full multi-model deliberation. Key findings that require further design work:

### 1. Version Pinning vs. Live References

KB references need two modes, declared at insertion time:
- **Versioned** (`kb://entry-uuid@v7`) — pinned to a specific version. Required for contracts, regulatory filings, signed documents.
- **Mutable** (`kb://entry-uuid@latest`) — always resolves to current published version. Used for live dashboards, slide decks with current data.

This is not optional — it's a legal audit requirement for regulated organizations.

### 2. KB Entry Lifecycle

Entries should have a governance lifecycle: `Draft → Reviewed → Published → Deprecated`. Only `Published` entries are available for RAG and cross-document citation. The `Reviewed → Published` gate is the sovereignty bottleneck — a human or authorized workflow makes knowledge "official."

### 3. Reverse Dependency Registry

The KB must track which documents/sheets/slides reference each entry. Without this:
- Erasure cascades can't identify affected documents
- Breaking changes to published entries can't warn consumers
- Staleness notifications can't reach maintainers

### 4. Snapshot Sets for Compound Filings

Regulatory filings often span multiple document types (narrative + data tables + summary presentation). All must cite KB entries as of the same logical moment. KB Snapshot Sets provide a timestamped, immutable slice of all published entry versions for a given filing.

### 5. Erasure vs. Immutability Tension

The Merkle/content-addressed versioning model and GDPR/PIPEDA erasure are in direct conflict. Tombstoning strategies need dedicated resolution — this is a known blocker shared with C3 (Data Erasure).

### 6. Corpus Partitioning for AI

KB entries need a corpus partition: `knowledge | operational | reference`. Only `knowledge` and `reference` partitions feed RAG. `operational` entries (templates, validation schemas) are excluded from AI inference to prevent hallucination contamination.

### 7. Jurisdiction-Scoped Truth

Federated instances may hold contradictory facts that are both correct in different legal contexts (e.g., data retention periods differ by jurisdiction). KB entries need a `jurisdiction` field, and federation should never auto-merge entries with overlapping jurisdictions.

## Consequences

1. Pillar 7 (References) ceases to exist as a standalone pillar; it becomes KB Milestone 1
2. All cross-cutting pillars get renumbered C1–C6
3. docs/mvp.md is restructured to reflect this hierarchy
4. New contracts created: `contracts/kb/rules.md`, `contracts/sheets-formula/rules.md`, `contracts/app/shell.md`, `contracts/app/slides-interaction.md`, `contracts/app/observability-dashboard.md`
5. AI document extractor needs KB-aware extraction (embed KB entries, not just doc text)
6. Convert module roadmap explicitly includes xlsx/ods/csv and pptx/odp
