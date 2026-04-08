# OpenDesk MVP

A sovereign, open-source office suite for Canadian and EU organizations who need an alternative to Google Docs and Microsoft 365 without surrendering data to foreign jurisdictions.

## Vision

Modern web-based office suite with real-time collaboration, mandatory data sovereignty (Canada/EU hosting), licensed under AGPL-3.0, and built using agent-first development methodology. The goal is not to clone Microsoft Office feature-for-feature, but to nail the 80% of document workflows that 95% of users actually need -- and do it with full transparency and self-host capability.

---

## Technical Architecture (MVP)

### Hybrid Approach

The core insight: trying to natively edit .docx files in a browser is a losing battle. Instead, we use a native web format for editing and a conversion service for interop.

- **Editor layer**: CRDTs (Yjs) for real-time collaboration, TipTap (ProseMirror-based) for rich text editing, canvas rendering where needed. The editor operates on its own JSON/HTML-based document model -- not on .docx internals.
- **Conversion service**: LibreOffice/Collabora running as a headless backend microservice. Handles import/export of .docx, .xlsx, .pptx, .odt, and PDF. This is a stateless service that takes a file in and spits a file out.
- **Native format**: JSON-based document format for internal editing and storage. Documents are converted on import and on export -- the user never touches the native format directly.
- **Backend**: Node.js API layer. WebSocket server (via Yjs provider) for real-time sync between collaborators.
- **Storage**: S3-compatible object storage for user documents (MinIO for self-host, OVH/Scaleway for managed). PostgreSQL for metadata, auth, version history, and sharing permissions.
- **Auth**: OpenID Connect / OAuth 2.0. Ships with a self-hostable identity provider (Keycloak or equivalent). Supports integration with existing enterprise IdPs (Azure AD, Okta, etc.) without requiring them.

### Key Architectural Decisions

1. **No native .docx editing.** We convert on import, edit in our format, convert on export. This avoids the complexity trap that killed every previous open-source Office competitor.
2. **CRDTs over OT.** Yjs gives us conflict-free real-time sync without a central authority server. Better for self-hosted deployments where network partitions are real.
3. **Conversion as a service.** LibreOffice is battle-tested for format conversion. Running it as a microservice means we can scale it independently and replace it later if something better comes along.
4. **Bilingual from day one.** Not as an afterthought. The i18n system is part of the initial scaffold, not a Phase 2 bolt-on.

---

## MVP Scope -- Phase 1: Documents

Focus on the document editor first. Not spreadsheets, not presentations. Just documents. Ship something real before expanding scope.

### Features

- Rich text editing: headings (H1-H6), ordered/unordered lists, bold, italic, underline, strikethrough, links, inline images, basic tables
- Real-time multi-user collaboration: visible cursors, presence indicators, live sync via Yjs
- Import from .docx, .odt, and .pdf (via conversion service)
- Export to .docx, .odt, and .pdf
- Version history: every save creates a version, users can browse and restore previous versions
- Basic sharing: link-based sharing with view/edit permission levels
- Self-hostable via Docker Compose (single command deployment)
- Bilingual UI: English and French from day one, with i18n framework ready for additional languages

### Non-Goals for MVP

- Spreadsheet editor (Phase 2)
- Presentation editor (Phase 3)
- Mobile apps (native mobile is a money pit; responsive web comes first)
- Offline mode (requires service workers and conflict resolution UX -- too much scope for MVP)
- Plugin/extension system (architecture should allow for it later, but no public API yet)
- Advanced formatting: mail merge, macros, track changes (comments and suggestions are done)
- E2E encryption (important but adds significant complexity; planned for post-MVP)

---

## Super-Pillars (Product Lines)

OpenDesk is organized into four **super-pillars** — independent product lines that share infrastructure but have their own editors, data models, and competitive landscapes. Six **cross-cutting pillars** provide platform capabilities (sovereignty, compliance, AI) that apply to all super-pillars.

See `decisions/2026-04-08-super-pillar-restructuring.md` for the full rationale.

### Documents (~95% complete)

The flagship product line. Rich text editing with TipTap + Yjs, real-time collaboration, comments/suggestions, tables, images, templates, find/replace, print/PDF, accessibility, i18n.

**Remaining work:** Offline mode (service workers), performance for 100+ page documents, spreadsheet/presentation embedding, plugin system.

**Formats:** .docx, .odt, .pdf (import/export working via Collabora)

### Knowledge Base (~58% complete)

A structured information store where organizational knowledge lives **separate from its presentation**. Documents, Sheets, and Slides *reference* KB entries — they don't own the underlying information. The existing Reference & Citation Management system (formerly Pillar 7, ~90% complete) is KB's first milestone. The generalized entry model with typed records (Reference, Entity, Dataset, Note), relationships (property graph lite), full-text search, and reverse dependency lookups is now implemented (`modules/kb/`).

**What it encompasses:**
1. **References** (done) — citations, bibliography entries, DOI/ISBN records, BibTeX/RIS import
2. **Entities** — people, organizations, projects, terms. A directory/glossary referenceable from any document type
3. **Datasets** — tabular data independent of any spreadsheet. Sheets *view* datasets; datasets persist if the sheet is deleted
4. **Notes & Clippings** — research fragments, excerpts, annotations. Raw material that feeds polished documents
5. **Relationships** — lightweight property graph connecting entries (person → org, dataset → source, reference → topic)

**Data model:** Typed records (`reference | entity | dataset | note | glossary`) with optional relationships, stored in PostgreSQL. Not a full graph database — relationship queries via SQL joins.

**Relationship to other super-pillars:** Primarily uni-directional pull with opt-in promotion:
- **Pull**: Docs/Sheets/Slides insert KB references via pickers (like the existing citation picker)
- **Promote**: Users explicitly promote content into the KB ("Save to Knowledge Base as Note")
- **Live references**: KB changes show a "source updated" indicator in consuming documents. User decides whether to accept. No silent mutation.

**Sovereignty angle:** The KB concentrates institutional knowledge in one auditable, erasable, federatable store on your infrastructure. It's the natural RAG corpus for local AI (C1), the primary audit target (C2), and the thing GDPR erasure requests hit (C3).

*Milestones:*
1. ~~Reference data model & storage~~ (done)
2. ~~Import/export BibTeX, RIS, DOI lookup~~ (done)
3. ~~In-editor citation insertion & bibliography~~ (done)
4. ~~**KB entry model**~~ (done) — Generalized typed KBEntry records (Reference, Entity, Dataset, Note) with tags, workspace scoping, Zod validation, version tracking. Relationships as first-class edges (cites, authored-by, related-to, derived-from, supersedes). Full-text search via PostgreSQL tsvector/GIN. See `modules/kb/` and `contracts/kb/rules.md`.
5. ~~**Reverse dependency registry**~~ (done) — Lookup all entries pointing at a given entry. Implemented in `modules/kb/internal/reverse-deps.ts`.
6. ~~**Entity directory**~~ (done) — People, organizations, terms with structured fields. Entity CRUD with subtype-specific content schemas (person, organization, project, term). Mention picker for all editors. Browser UI with search and filtering. See `modules/kb/internal/pg-entities.ts`.
7. ~~**Dataset store**~~ (done) — Tabular row data storage in `kb_dataset_rows` table with JSONB rows, column schema definitions in entry metadata, atomic row replacement, paginated reads. API routes at `/api/kb/entries/:id/rows`. Browser UI with table preview and column editor. See `modules/kb/internal/pg-datasets.ts` and `modules/api/internal/kb-dataset-routes.ts`.
8. **Notes & clippings** — Capture from documents (promote action), freeform entry, tag-based organization.
9. **KB query contract** — Stable, versioned API with corpus partitioning (`knowledge | operational | reference`), jurisdiction scoping, and snapshot resolution.
10. ~~**KB browser UI**~~ (done) — Dedicated interface for browsing, filtering, managing entries, and visualizing relationships. Grid/list view toggle, search with debounce, type/tag filters, sort options, detail panel with type-specific metadata rendering, relationship viewer, create/edit forms. See `modules/app/internal/kb-browser/`.
11. **Snapshot sets** — Immutable timestamped slices of published entry versions for compound regulatory filings spanning multiple document types.
12. **Relationship graph** — Queryable connections between KB entries. Graph is an overlay, not the load-bearing structure — cross-document references bind to entry ID, not graph predicates.

### Sheets (~50% complete)

Spreadsheet editor. Same architecture: native web format for editing, conversion service for .xlsx/.ods import/export. Functional prototype with grid, formula engine, formatting, multi-sheet tabs, copy/paste, and column/row operations.

**What works:** Grid rendering, cell selection with formula bar, real-time Yjs sync, collaborative presence. Formula engine with 20+ functions. Cell formatting. Multi-sheet tabs. Copy/paste with range selection. Column/row resize (drag handles, Yjs-synced widths), insert/delete rows and columns with format key shifting, right-click context menu on headers.

**What's next:** Sorting & filtering, charts, import/export.

*Milestones:*
1. ~~**Formula engine**~~ (done) — Recursive descent parser with operator precedence, AST evaluator, 20+ functions (SUM, AVERAGE, COUNT, MIN, MAX, IF, VLOOKUP, CONCATENATE, text functions), cell references (A1, $A$1, ranges), all Excel error types (#VALUE!, #REF!, #DIV/0!, #NAME?, #N/A, #NUM!), circular reference detection via DFS. See `modules/sheets-formula/` and `contracts/sheets-formula/rules.md`.
2. ~~**Cell formatting**~~ (done) — Bold, italic, underline, strikethrough, font size, text/background colors, alignment, number formats (general, number, currency, percentage, date), borders. Yjs-backed format store, format toolbar with sections, keyboard shortcuts (Ctrl+B/I/U). See `modules/app/internal/sheets-format-*.ts`.
3. ~~**Multi-sheet tabs**~~ (done) — Tab bar with add/delete/rename, context menu, cross-sheet references (Sheet2!A1 syntax), cell evaluator for cross-sheet resolution. See `modules/app/internal/sheets/`.
4. ~~**Copy/paste & keyboard shortcuts**~~ (done) — Multi-cell range selection (click, shift+click, drag), custom clipboard handlers for copy/cut/paste, TSV for external apps, internal format preserving values and formatting. See `modules/app/internal/sheets/range-selection.ts` and `modules/app/internal/sheets/clipboard.ts`.
5. ~~**Column/row operations**~~ (done) — Column resize via drag handles on header edges (Yjs-synced widths), row height resize, insert/delete rows and columns with automatic format key shifting, right-click context menu on headers. See `modules/app/internal/sheets/col-row-resize.ts`, `col-row-ops.ts`, `header-context-menu.ts`.
6. **Sorting & filtering** — Column sort (asc/desc), auto-filter dropdowns, filter by value/condition.
7. **Basic charts** — Bar, line, pie from selected data ranges. Embedded in sheet or as separate view.
8. **Import/export** — .xlsx, .ods, .csv via Collabora pipeline extension.
9. **Conditional formatting** — Color scales, data bars, icon sets based on cell values.
10. **Dataset integration** — View KB datasets as read-only or editable sheets. Bi-directional sync with KB dataset store.

Does not attempt: pivot tables, VBA macros, advanced data analysis, Power Query equivalent. Those are post-1.0.

### Slides (~45% complete)

Presentation editor. Full element interaction, multiple element types, rich text formatting, slide layouts with master templates, and presentation themes.

**What works:** Slide list with thumbnails, main viewport at 16:9, text/image/shape/table elements, Yjs sync, presence. Full element interaction (drag, resize, rotate, snap, multi-select, z-order). Rich text formatting with toolbar. Slide layouts: blank, title, title+content, two-column, section header, title-only — with layout picker dropdown and placeholder auto-creation. Presentation themes: 6 presets (Default, Dark, Corporate, Warm, Minimal, Ocean) with CSS custom properties, Yjs-synced theme state, and theme picker UI.

**What's next:** Transitions, speaker notes, presenter mode.

*Milestones:*
1. ~~**Element interaction**~~ (done) — Drag, resize (8 handles + Shift for aspect ratio), rotate (15° snap), snap engine (grid + element edges), selection manager (single/multi/marquee), z-order (bring forward/back/front/bottom), Yjs transactional mutations, DOM overlay rendering. See `modules/app/internal/slides/` and `contracts/app/slides-interaction.md`.
2. ~~**Element types**~~ (done) — Images (S3 upload), shapes (rectangle, circle, arrow, line), tables. Insert toolbar for adding elements. Shape rendering with fill/stroke. See `modules/app/internal/slides/render-shape.ts`.
3. ~~**Text formatting**~~ (done) — Rich text within text and shape elements (bold, italic, underline, font size, color, alignment). Formatting toolbar with font controls. See `modules/app/internal/slides/text-format-toolbar.ts` and `modules/app/internal/slides/render-text.ts`.
4. ~~**Slide layouts & themes**~~ (done) — 6 layout types (blank, title, title+content, two-column, section header, title-only) with placeholder auto-positioning. Layout picker dropdown replaces "Add Slide" button. 6 theme presets (Default, Dark, Corporate, Warm, Minimal, Ocean) with colors, fonts, and background applied via CSS custom properties. Theme picker UI with color swatches. Theme state Yjs-synced for real-time collaboration. See `modules/app/internal/slides/layouts.ts`, `themes.ts`, `layout-picker.ts`, `theme-picker.ts`.
5. **Transitions** — Basic slide transitions (fade, slide, none). Not element animations.
6. **Speaker notes** — Per-slide notes panel, visible in edit mode and presenter mode.
7. **Presenter mode** — Full-screen presentation with current slide, next slide preview, speaker notes, timer. Separate window/tab.
8. **Import/export** — .pptx, .odp, .pdf via Collabora pipeline extension.
9. **Slide sorter** — Drag-to-reorder in thumbnail panel, duplicate/delete slides.
10. **KB integration** — Insert citations, entity references, and dataset charts from Knowledge Base.

Does not attempt: element animations, video embedding, 3D transitions, custom slide sizes. Post-1.0.

### App Shell (shared infrastructure)

Not a super-pillar but enables all of them: dashboard, navigation, type switching, theming, workspace management.

**Current state:** Unified SPA with client-side pushState routing, dynamic editor loading via ESM code splitting, shared chrome (nav sidebar, top bar). Routes: `/` (dashboard), `/doc/:id` (editor), `/sheet/:id` (spreadsheet), `/slides/:id` (presentation). Old HTML pages preserved for backward compatibility. Editor chunk lazy-loaded on demand. Full cleanup on view transitions (editor destroy, WebSocket disconnect, listener removal).

**Remaining:** Offline mode (service workers), shared state persistence, cross-type search.

*Milestones:*
1. ~~**Unified routing**~~ (done) — pushState router with param extraction, link interception, popstate handling. Lazy loader with module caching. Shared shell with nav sidebar and view mount/unmount lifecycle. See `modules/app/internal/shell/` and `contracts/app/shell.md`.
2. **Workspace sidebar** — Tree view of folders, recent documents across all types, starred items, KB quick search.
3. **Cross-type search** — Global search that finds documents, sheets, slides, and KB entries.
4. **Theming** — Light/dark mode, customizable accent colors, workspace-level branding.
5. **Notifications** — In-app notifications for comments, shares, workflow triggers, KB updates.

---

## Milestones

### Completed

1. **Foundation** -- Repository setup, contracts-first methodology, governance documents, architectural decisions documented in `decisions/` directory.

2. **Skeleton** -- Project scaffolding: monorepo structure with 11 modules, CI/CD pipeline, contract templates for all MVP modules, dev environment setup (Docker Compose for local dev).

3. **Phase 0: Technical Debt Cleanup** -- Role type unification (canonical `Role` enum in permissions/contract.ts), barrel-file module boundary enforcement (11/11 modules), contract compliance from 52% to 100%.

4. **Pillar 0: Editor Foundation** -- The core editing experience, built to be competitive with Google Docs for daily use:
   - Comments & suggestions (inline threads, suggest-mode with accept/reject)
   - Tables (resizable columns, merged cells, header rows)
   - Images & media (drag-and-drop upload to S3, resize handles)
   - Document templates (picker UI, template library, create-from-template)
   - Find & replace (with regex support)
   - Print/PDF (CSS print stylesheet, export to PDF)
   - Accessibility (ARIA labels, keyboard navigation, screen reader support)
   - Mobile responsive (touch-friendly toolbar, responsive layout)
   - i18n (English and French)

5. **Self-Host Deployment** -- Docker Compose deployment with PostgreSQL, Redis, MinIO, nginx. Schema initialization and environment configuration.

6. **Testing** -- 17 Playwright E2E tests covering the MVP workflow. Yjs collaboration stress tests and HTTP load testing. 32+ unit/integration test files across all modules.

7. **Conversion Service** -- Collabora/LibreOffice microservice in Docker Compose. Import .docx/.odt/.pdf via convert-import API, export to .docx/.odt via convert-export API. Frontend import/export buttons wired to Collabora endpoints.

8. **Auth + Sharing Integration** -- OIDC token verification (jose library), auth middleware on all /api routes, share link creation with 256-bit tokens, grant persistence on link redemption, share dialog UI with role selector and link generation.

9. **C2 Milestone 1: Cryptographic Audit Foundation** -- Append-only HMAC-chained audit log. PG trigger enforces immutability. Per-document hash chain with tamper verification. API endpoints for audit log querying and chain integrity verification.

10. **C4 Milestone 1: Trigger/Action API** -- Event-driven workflow definitions on documents. Trigger types (document.updated, document.exported, grant.created, grant.revoked) mapped to actions (webhook, export, notify). Full CRUD API with execution history tracking.

11. **Events Module** -- Full EventBus implementation: PG transactional outbox, Redis Streams consumer groups, outbox poller for reliable delivery, 7-day TTL pruning, schema registry with one-owner-per-type enforcement.

### In Progress

12. **Editor Core Hardening** -- Performance optimization for large documents and many collaborators. Stress test validation ongoing.

13. **Beta** -- End-to-end testing of the create→edit→share→export workflow with real documents. Bug fixing, performance tuning, format conversion quality improvements.

---

## Cross-Cutting Pillars (Platform Capabilities)

These pillars provide sovereignty, compliance, and intelligence capabilities that apply to **all** super-pillars. They were originally defined as Pillars 1-6 (see `decisions/2026-04-06-strategic-roadmap-segments-deliberation.md`), renumbered as C1-C6 in the super-pillar restructuring (see `decisions/2026-04-08-super-pillar-restructuring.md`). Former Pillar 7 (References) has been absorbed into the Knowledge Base super-pillar.

### C1: Air-Gapped Local AI (BYOM) — ~70% complete

Sovereign AI for organizations that cannot send data to cloud LLMs. BYOM abstraction over Ollama, pgvector in existing PostgreSQL, local RAG pipeline. Serves defense, healthcare, and legal sectors.

**Applies to all super-pillars:** Document summarization, spreadsheet formula suggestions, slide content generation, KB-powered RAG (the KB is the natural primary corpus).

*Milestones:* ~~BYOM abstraction layer~~ -> ~~CRDT-to-vector pipeline~~ -> ~~Local semantic search~~ -> ~~Context-aware document assistant~~ -> KB-aware extraction (embed KB entries, not just doc text) -> Cross-type extractors (cells, slides) -> Curated sovereign model zoo.

### C2: Cryptographic Audit & e-Discovery — ~85% complete

Tamper-evident, append-only cryptographic ledger of all mutations and access events. Merkle-tree backed. Targets pharma (FDA CFR 21 Part 11), finance (FINRA), forensics.

**Applies to all super-pillars:** Already event-driven and type-agnostic. Any super-pillar that emits events gets audit coverage automatically.

*Milestones:* ~~Append-only HMAC-chained event store~~ -> ~~Point-in-time verifiability~~ -> ~~Tamper verification API~~ -> Signed Yjs updates -> Automated SAR/FOIA engine -> eDiscovery export formats.

### C3: Verifiable Data Erasure & CRDT Pruning — ~40% complete

Solving the CRDT/GDPR collision -- Yjs tombstones retain deleted content, conflicting with Right to Be Forgotten. Uses structural tombstone anonymization (zero-fill payload while preserving CRDT pointers).

**Applies to all super-pillars:** Each content type has different CRDT structures (XmlFragment, Y.Array, Y.Map) requiring type-specific erasure strategies. KB entries add a new dimension: erasing a KB entry must cascade notifications to all referencing documents.

*Milestones:* ~~Erasure attestations~~ -> ~~Retention policies~~ -> Tombstone extraction tooling -> Structural anonymization -> Targeted redaction API -> Policy-driven automated pruning -> KB cascade erasure.

### C4: Sovereign Data Workflows & Process Automation — ~50% complete

Visual workflow builder for content pipelines -- approval chains, redaction, translation, archival. All local execution via Wasm sandboxing (Extism/Wasmtime). No data leakage to external services.

**Applies to all super-pillars:** Workflows trigger on any content type. Document approval chains, spreadsheet data validation pipelines, presentation review workflows, KB entry curation flows.

*Milestones:* ~~Trigger/action API~~ -> ~~Execution history~~ -> Visual workflow editor -> Conditional logic & branching -> Local service integrations (Wasm) -> Auditable execution logs.

### C5: Cross-Sovereign Federation — ~55% complete

Real-time Yjs collaboration between isolated OpenDesk instances. Targets government-contractor collaboration, hospital networks, B2B consortiums. Uses CRDT sub-document partitioning for scoped federation.

**Applies to all super-pillars:** Federate documents, spreadsheets, slides, and KB entries. Shared glossaries and reference libraries across instances are a key use case.

*Milestones:* ~~Peer registration~~ -> ~~Document transfer with Ed25519 signing~~ -> OIDC/SAML identity federation -> Server-to-server sync protocol -> Federated permission mapping -> KB library federation -> Split-brain resolution.

### C6: Sovereign Observability & Compliance Control Plane — ~65% complete

Unified real-time dashboard for the entire stack's compliance posture. Transforms passive audit trails into active, queryable instrumentation. The connective tissue that consumes output from all other pillars and all super-pillars.

*Milestones:* ~~Metrics collection~~ -> ~~Health monitoring~~ -> ~~HTTP middleware~~ -> ~~Time-series API with adaptive bucketing~~ -> ~~Live compliance dashboard UI~~ (Canvas 2D charts, health panel, correlation search, compliance CSV/JSON export — see `modules/app/internal/admin/` and `contracts/app/observability-dashboard.md`) -> Unified telemetry across all content types -> Anomaly detection -> Drill-down forensics -> SIEM export.

### Sequencing

```
Super-Pillars (Product Lines)              Cross-Cutting Pillars
━━━━━━━━━━━━━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━━━━━━━━
Documents ████████████████████░             C4 (Workflows) ──┬── C2 (Audit)
KB        ████████░░░░░░░░░░░░                              │
Sheets    █████░░░░░░░░░░░░░░░             C6 (Observe) ────┤── C1 (AI)
Slides    ████░░░░░░░░░░░░░░░░                              │
                                            C3 (Erasure) ───┘
                                                     │
                                            C5 (Federation) ── depends on all
```

**Priority order for super-pillars:** Documents (flagship) > KB (high leverage, entry model landed) > Sheets (formula engine landed, next: formatting) > Slides (element interaction landed, next: element types).

**Cross-cutting validation:** Each cross-cutting pillar must be validated against all super-pillars, not just Documents. As Sheets and Slides mature, audit/erasure/AI capabilities must cover their content types.

Full dependency analysis: `decisions/2026-04-06-pillar-sequencing-deliberation.md`

---

## Data Sovereignty Requirements

This is not a feature -- it is a hard constraint that shapes every technical decision.

- **Hosting**: All infrastructure in Canadian or EU data centers. OVHcloud, Scaleway, Hetzner, or equivalent. No AWS/Azure/GCP as primary hosting (can be used as fallback only with data-at-rest encryption and contractual guarantees).
- **PIPEDA compliance**: Personal data handling follows Canadian privacy law from day one. Privacy impact assessments for all data flows.
- **GDPR compliance**: EU data protection requirements met from day one. Data portability, right to erasure, lawful basis for processing.
- **No telemetry without explicit opt-in**: The default installation phones home to exactly zero servers. Usage analytics are opt-in only, with clear disclosure of what is collected.
- **Self-host option**: Organizations that need full control can run the entire stack on their own infrastructure. No features gated behind a managed service.
- **Health data readiness**: Architecture supports provincial health data compliance (PHIPA for Ontario, HIA for Alberta, etc.) without requiring it for general use. This means audit logging, access controls, and encryption are built in, not bolted on.
- **Data residency guarantees**: The system knows where data lives and can prove it. No silent replication to other regions.

---

## Success Criteria for MVP

The MVP is done when all of the following are true:

1. A user can create a new document and edit it with rich text formatting.
2. A second user can join the same document and collaborate in real-time -- both see each other's cursors and edits with sub-second latency.
3. A user can import a .docx file, edit it in the browser, and export it back to .docx without major formatting loss (headings, lists, bold/italic, images, and tables survive the round trip).
4. The entire stack deploys via `docker compose up` with no manual configuration beyond environment variables.
5. All of the above works with data stored exclusively in Canada or the EU.
6. Every architectural decision is documented in the `decisions/` directory with context, options considered, and rationale.
7. The UI is functional in both English and French.
8. A non-technical user can complete the create-edit-share-export workflow without reading documentation.
