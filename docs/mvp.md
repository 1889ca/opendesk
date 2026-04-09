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

### Documents (~98% complete)

The flagship product line. Rich text editing with TipTap + Yjs, real-time collaboration, comments/suggestions, tables, images, templates, find/replace, print/PDF, accessibility, i18n. Offline editing via service workers with automatic CRDT merge on reconnect.

**Remaining work:** Performance for 100+ page documents, spreadsheet/presentation embedding, plugin system.

**Formats:** .docx, .odt, .pdf (import/export working via Collabora)

### Knowledge Base (~98% complete)

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
8. ~~**Notes & clippings**~~ (done) — Promote-from-document action in editor toolbar. Quick note creator (inline form, visible when Notes filter active). Markdown preview in detail panel via simple-markdown renderer. Pinned notes section at top of list. Pin/unpin toggle in detail actions. See `modules/app/internal/kb-browser/quick-note.ts`, `simple-markdown.ts`, `pinned-section.ts`.
9. ~~**KB query contract**~~ (done) — Corpus partitioning (`knowledge | operational | reference`) and jurisdiction scoping fields on all KB entries. Query API filters by corpus and jurisdiction. Search respects both dimensions. Entries default to `knowledge` corpus. Jurisdiction is nullable (null = universal). Schema migration is idempotent. See `modules/kb/internal/entries-store.ts`, `search.ts`, `schema.ts`.
10. ~~**KB browser UI**~~ (done) — Dedicated interface for browsing, filtering, managing entries, and visualizing relationships. Grid/list view toggle, search with debounce, type/tag filters, sort options, detail panel with type-specific metadata rendering, relationship viewer, create/edit forms. See `modules/app/internal/kb-browser/`.
11. ~~**Snapshot sets**~~ (done) — `kb_snapshots` table with id, workspace_id, purpose, captured_by, captured_at, entry_versions (JSONB). Create snapshot captures all current entry versions atomically. Resolve snapshot fetches version history records. API at `/api/kb/snapshots`. Browser UI with create button, snapshot list, and entry resolution view. See `modules/kb/internal/pg-snapshots.ts`, `modules/api/internal/kb-snapshot-routes.ts`.
12. ~~**Relationship graph**~~ (done) — Interactive SVG-based force-directed graph visualization. Pure DOM/SVG rendering (no external libs). Nodes colored by entry type, edges labeled by relation type. Click node to open detail. Depth selector (1/2/3 hops). Graph panel opens from "View Graph" button in detail. See `modules/app/internal/kb-browser/graph-*.ts`.

### Sheets (~98% complete)

Spreadsheet editor. Feature-rich with formula engine, formatting, multi-sheet tabs, copy/paste, column/row operations, sorting & filtering, conditional formatting, charts, import/export, and KB dataset integration.

**What works:** Grid rendering, cell selection, real-time Yjs sync, presence. Formula engine (20+ functions). Cell formatting. Multi-sheet tabs. Copy/paste with range selection. Column/row operations. Sorting & filtering. Conditional formatting. Basic charts (bar, line, pie) with Canvas 2D rendering, Yjs sync, drag/resize. Import/export (.xlsx, .ods, .csv). KB dataset integration with bi-directional sync.

**Post-1.0:** Pivot tables, advanced data analysis.

*Milestones:*
1. ~~**Formula engine**~~ (done) — Recursive descent parser with operator precedence, AST evaluator, 20+ functions (SUM, AVERAGE, COUNT, MIN, MAX, IF, VLOOKUP, CONCATENATE, text functions), cell references (A1, $A$1, ranges), all Excel error types (#VALUE!, #REF!, #DIV/0!, #NAME?, #N/A, #NUM!), circular reference detection via DFS. See `modules/sheets-formula/` and `contracts/sheets-formula/rules.md`.
2. ~~**Cell formatting**~~ (done) — Bold, italic, underline, strikethrough, font size, text/background colors, alignment, number formats (general, number, currency, percentage, date), borders. Yjs-backed format store, format toolbar with sections, keyboard shortcuts (Ctrl+B/I/U). See `modules/app/internal/sheets-format-*.ts`.
3. ~~**Multi-sheet tabs**~~ (done) — Tab bar with add/delete/rename, context menu, cross-sheet references (Sheet2!A1 syntax), cell evaluator for cross-sheet resolution. See `modules/app/internal/sheets/`.
4. ~~**Copy/paste & keyboard shortcuts**~~ (done) — Multi-cell range selection (click, shift+click, drag), custom clipboard handlers for copy/cut/paste, TSV for external apps, internal format preserving values and formatting. See `modules/app/internal/sheets/range-selection.ts` and `modules/app/internal/sheets/clipboard.ts`.
5. ~~**Column/row operations**~~ (done) — Column resize via drag handles on header edges (Yjs-synced widths), row height resize, insert/delete rows and columns with automatic format key shifting, right-click context menu on headers. See `modules/app/internal/sheets/col-row-resize.ts`, `col-row-ops.ts`, `header-context-menu.ts`.
6. ~~**Sorting & filtering**~~ (done) — Column sort (asc/desc) via header context menu and filter dropdown, with numeric/string auto-detection. Filter state manager tracks active filters per column (view-only, hides rows without modifying Yjs data). Auto-filter dropdowns with unique value checkboxes, select all/clear. Filter bar with funnel icons on column headers. See `modules/app/internal/sheets/sort-engine.ts`, `filter-state.ts`, `filter-dropdown.ts`, `filter-bar.ts`, `filter-manager.ts`.
7. ~~**Basic charts**~~ (done) — Bar, line, pie from selected data ranges. Canvas 2D rendering, Yjs-synced chart definitions, draggable/resizable overlays, live data updates. See `modules/app/internal/charts/`.
8. ~~**Import/export**~~ (done) — CSV direct parser (RFC 4180), .xlsx/.ods via Collabora. Import/export buttons in toolbar. See `modules/convert/internal/csv-parser.ts`, `spreadsheet-importer.ts`, `spreadsheet-exporter.ts`.
9. ~~**Conditional formatting**~~ (done) — Color scales (min/max color interpolation), data bars (percentage width relative to column max), highlight rules (greater/less/equal/between/text-contains with custom colors), icon sets (arrows/circles/flags dividing range into thirds). Rules stored in Yjs Y.Array, dialog for creating rules with type selector and color pickers, renderer applies styles after each grid render. See `modules/app/internal/sheets/cond-format-*.ts`.
10. ~~**Dataset integration**~~ (done) — Link KB datasets to sheets, view as read-only or editable, push changes back to KB. Dataset picker modal, visual indicator for linked cells. See `modules/app/internal/sheets/dataset-link.ts`, `dataset-picker.ts`, `dataset-ui.ts`.

Does not attempt: pivot tables, VBA macros, advanced data analysis, Power Query equivalent. Those are post-1.0.

### Slides (~98% complete)

Presentation editor. Full-featured with element interaction, rich formatting, layouts, themes, speaker notes, presenter mode, transitions, slide sorter, import/export, and KB integration.

**What works:** All element types with full interaction. Rich text formatting. 6 layouts, 6 themes. Speaker notes with Yjs sync. Presenter mode with timer and keyboard nav. Slide transitions. Slide sorter with drag-to-reorder. Import/export (.pptx, .odp, .pdf via Collabora). KB integration (citation picker, entity mentions, dataset charts, stale source detection).

**Post-1.0:** Element animations, video embedding.

*Milestones:*
1. ~~**Element interaction**~~ (done) — Drag, resize (8 handles + Shift for aspect ratio), rotate (15° snap), snap engine (grid + element edges), selection manager (single/multi/marquee), z-order (bring forward/back/front/bottom), Yjs transactional mutations, DOM overlay rendering. See `modules/app/internal/slides/` and `contracts/app/slides-interaction.md`.
2. ~~**Element types**~~ (done) — Images (S3 upload), shapes (rectangle, circle, arrow, line), tables. Insert toolbar for adding elements. Shape rendering with fill/stroke. See `modules/app/internal/slides/render-shape.ts`.
3. ~~**Text formatting**~~ (done) — Rich text within text and shape elements (bold, italic, underline, font size, color, alignment). Formatting toolbar with font controls. See `modules/app/internal/slides/text-format-toolbar.ts` and `modules/app/internal/slides/render-text.ts`.
4. ~~**Slide layouts & themes**~~ (done) — 6 layout types (blank, title, title+content, two-column, section header, title-only) with placeholder auto-positioning. Layout picker dropdown replaces "Add Slide" button. 6 theme presets (Default, Dark, Corporate, Warm, Minimal, Ocean) with colors, fonts, and background applied via CSS custom properties. Theme picker UI with color swatches. Theme state Yjs-synced for real-time collaboration. See `modules/app/internal/slides/layouts.ts`, `themes.ts`, `layout-picker.ts`, `theme-picker.ts`.
5. ~~**Transitions**~~ (done) — 5 transition types (none, fade, slide-left, slide-right, zoom) stored per-slide in Yjs. CSS Web Animations API for smooth playback in presenter mode with forward/backward direction support. Transition picker dropdown in toolbar. See `modules/app/internal/slides/transitions.ts`.
6. ~~**Speaker notes**~~ (done) — Per-slide notes stored in Yjs ('notes' key on slide Y.Map), collapsible textarea panel below viewport, debounced 300ms save, remote change sync. See `modules/app/internal/slides/speaker-notes.ts`.
7. ~~**Presenter mode**~~ (done) — Opens in new window with current slide rendering, next slide preview, speaker notes display, presentation timer, slide counter. Keyboard navigation: arrows/space/PageDown for next, PageUp for previous, Home/End for first/last, Escape to close. Self-contained CSS. See `modules/app/internal/slides/presenter-mode.ts`.
8. ~~**Import/export**~~ (done) — .pptx/.odp import via Collabora with slide structure parsing, export to PDF/PPTX/ODP. Import/export buttons in toolbar. See `modules/convert/internal/slide-parser.ts`, `slide-importer.ts`, `slide-exporter.ts`.
9. ~~**Slide sorter**~~ (done) — Drag-to-reorder thumbnails via HTML5 drag-and-drop with visual feedback (dragging opacity, drop target highlight). Right-click context menu on thumbnails for Duplicate and Delete. Deep clone with new UUIDs for duplicated elements. MutationObserver auto-enables drag on new thumbnails. See `modules/app/internal/slides/slide-sorter.ts`.
10. ~~**KB integration**~~ (done) — "Insert from KB" button with citation picker, entity mention insertion, dataset chart embedding. KB references show "source updated" indicator when entries change. See `modules/app/internal/slides/kb-picker.ts`, `kb-toolbar.ts`, `kb-elements.ts`.

Does not attempt: element animations, video embedding, 3D transitions, custom slide sizes. Post-1.0.

### App Shell (shared infrastructure)

Not a super-pillar but enables all of them: dashboard, navigation, type switching, theming, workspace management.

**Current state:** Unified SPA with client-side pushState routing, dynamic editor loading via ESM code splitting, shared chrome (nav sidebar, top bar). Routes: `/` (dashboard), `/doc/:id` (editor), `/sheet/:id` (spreadsheet), `/slides/:id` (presentation). Old HTML pages preserved for backward compatibility. Editor chunk lazy-loaded on demand. Full cleanup on view transitions (editor destroy, WebSocket disconnect, listener removal).

**Remaining:** Shared state persistence across views (partially done via IndexedDB offline storage).

*Milestones:*
1. ~~**Unified routing**~~ (done) — pushState router with param extraction, link interception, popstate handling. Lazy loader with module caching. Shared shell with nav sidebar and view mount/unmount lifecycle. See `modules/app/internal/shell/` and `contracts/app/shell.md`.
2. ~~**Workspace sidebar**~~ (done) — Collapsible left nav with recent docs (localStorage), starred items (API-backed), folder tree (2 levels), quick search filter. Collapse toggle with persisted state. See `modules/app/internal/shared/workspace-sidebar.ts`, `sidebar-sections.ts`.
3. ~~**Cross-type search**~~ (done) — Global Cmd/Ctrl+K search across documents, sheets, slides, and KB entries. Results grouped by type with icons and snippets. Debounced 300ms, recent searches in localStorage. See `modules/storage/internal/pg-global-search.ts`, `modules/app/internal/editor/global-search.ts`.
4. ~~**Theming**~~ (done) — Light/dark/system mode with `prefers-color-scheme` default. Accent color picker (6 presets + custom). CSS custom properties throughout. Persisted in localStorage. See `modules/app/internal/shared/theme-toggle.ts`, `accent-color.ts`.
5. ~~**Notifications**~~ (done) — Bell icon with unread badge, dropdown panel, notification types (comment, share, workflow, KB update). EventBus subscriber generates notifications. PostgreSQL store, API routes, mark-read/dismiss. See `modules/notifications/`, `modules/app/internal/shared/notification-bell.ts`.

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
9. **Pillar 2 Milestone 1: Cryptographic Audit Foundation** -- Append-only HMAC-chained audit log. PG trigger enforces immutability. Per-document hash chain with tamper verification. API endpoints for audit log querying and chain integrity verification.
10. **Pillar 4 Milestone 1: Trigger/Action API** -- Event-driven workflow definitions on documents. Trigger types (document.updated, document.exported, grant.created, grant.revoked) mapped to actions (webhook, export, notify). Full CRUD API with execution history tracking.

11. **Events Module** -- Full EventBus implementation: PG transactional outbox, Redis Streams consumer groups, outbox poller for reliable delivery, 7-day TTL pruning, schema registry with one-owner-per-type enforcement.

### In Progress

12. **Editor Core Hardening** -- Performance optimization for large documents and many collaborators. Stress test validation ongoing.

13. **Beta** -- End-to-end testing of the create→edit→share→export workflow with real documents. Bug fixing, performance tuning, format conversion quality improvements.

---

## Cross-Cutting Pillars (Platform Capabilities)

These pillars provide sovereignty, compliance, and intelligence capabilities that apply to **all** super-pillars. They were originally defined as Pillars 1-6 (see `decisions/2026-04-06-strategic-roadmap-segments-deliberation.md`), renumbered as C1-C6 in the super-pillar restructuring (see `decisions/2026-04-08-super-pillar-restructuring.md`). Former Pillar 7 (References) has been absorbed into the Knowledge Base super-pillar.

### C1: Air-Gapped Local AI (BYOM) — ~100% complete

Sovereign AI for organizations that cannot send data to cloud LLMs. BYOM abstraction over Ollama, pgvector in existing PostgreSQL, local RAG pipeline. Serves defense, healthcare, and legal sectors.

**Applies to all super-pillars:** Document summarization, spreadsheet formula suggestions, slide content generation, KB-powered RAG (the KB is the natural primary corpus).

*Milestones:* ~~BYOM abstraction layer~~ -> ~~CRDT-to-vector pipeline~~ -> ~~Local semantic search~~ -> ~~Context-aware document assistant~~ -> ~~KB-aware extraction~~ (done — type-specific extractors for all 5 KB entry types, corpus partitioning, lifecycle-aware embedding) -> ~~Cross-type extractors~~ (done — spreadsheet cell/formula extraction, slide element/notes extraction) -> ~~Curated sovereign model zoo~~ (done — 12 curated models, Ollama pull/delete, per-workspace config, admin UI with install/remove, custom model support).

### C2: Cryptographic Audit & e-Discovery — ~98% complete

Tamper-evident, append-only cryptographic ledger of all mutations and access events. Merkle-tree backed. Targets pharma (FDA CFR 21 Part 11), finance (FINRA), forensics.

**Applies to all super-pillars:** Already event-driven and type-agnostic. Any super-pillar that emits events gets audit coverage automatically.

*Milestones:* ~~Append-only HMAC-chained event store~~ -> ~~Point-in-time verifiability~~ -> ~~Tamper verification API~~ -> ~~Signed Yjs updates~~ (done — Ed25519 signing of Yjs binary diffs, full-chain verification API) -> ~~Automated SAR/FOIA engine~~ (done — subject access request by user ID, FOIA export by document + date range) -> ~~eDiscovery export formats~~ (done — JSON, CSV, human-readable text; admin UI panel).

### C3: Verifiable Data Erasure & CRDT Pruning — ~100% complete

Solving the CRDT/GDPR collision -- Yjs tombstones retain deleted content, conflicting with Right to Be Forgotten. Uses structural tombstone anonymization (zero-fill payload while preserving CRDT pointers).

**Applies to all super-pillars:** Each content type has different CRDT structures (XmlFragment, Y.Array, Y.Map) requiring type-specific erasure strategies. KB entries add a new dimension: erasing a KB entry must cascade notifications to all referencing documents.

*Milestones:* ~~Erasure attestations~~ -> ~~Retention policies~~ -> ~~Tombstone extraction tooling~~ (done — scan Yjs docs for deleted content, extract to sealed archive) -> ~~Structural anonymization~~ (done — zero-fill tombstone payloads preserving CRDT clocks, per-user targeting) -> ~~Targeted redaction API~~ (done — redact by user ID or pattern, HMAC-chained attestation) -> ~~Policy-driven automated pruning~~ (done — retention rules, dry-run preview, interval scheduler) -> ~~KB cascade erasure~~ (done — reverse dependency lookup, placeholder replacement, cascade attestation) -> ~~Erasure-immutability resolution~~ (done — HMAC-signed erasure bridges, 3-state chain verification VALID/VALID_WITH_ERASURES/TAMPERED, legal holds, conflict detection, jurisdiction-aware policies for 15 combos, selective disclosure proofs).

### C4: Sovereign Data Workflows & Process Automation — ~100% complete

Visual workflow builder for content pipelines -- approval chains, redaction, translation, archival. All local execution via Wasm sandboxing (Extism/Wasmtime). No data leakage to external services.

**Applies to all super-pillars:** Workflows trigger on any content type. Document approval chains, spreadsheet data validation pipelines, presentation review workflows, KB entry curation flows.

*Milestones:* ~~Trigger/action API~~ -> ~~Execution history~~ -> ~~Visual workflow editor~~ (done — SVG drag-and-drop flow editor, node palette, properties panel, save/load) -> ~~Conditional logic & branching~~ (done — field comparisons, if/else branching, parallel splits) -> ~~Local service integrations (Wasm)~~ (done — Wasm sandbox with memory/CPU limits, plugin registry with CRUD API, 3 built-in plugins, wasm_plugin action type, visual editor integration) -> ~~Auditable execution logs~~ (done — per-node step logging, execution history UI with drill-down).

### C5: Cross-Sovereign Federation — ~95% complete

Real-time Yjs collaboration between isolated OpenDesk instances. Targets government-contractor collaboration, hospital networks, B2B consortiums. Uses CRDT sub-document partitioning for scoped federation.

**Applies to all super-pillars:** Federate documents, spreadsheets, slides, and KB entries. Shared glossaries and reference libraries across instances are a key use case.

*Milestones:* ~~Peer registration~~ -> ~~Document transfer with Ed25519 signing~~ -> ~~OIDC/SAML identity federation~~ (done — JWKS token verification, SAML assertion parsing, identity mapping table) -> ~~Server-to-server sync protocol~~ (done — bidirectional Yjs WebSocket sync with Ed25519-signed handshake) -> ~~Federated permission mapping~~ (done — role ceiling enforcement, signed revocation) -> ~~KB library federation~~ (done — subscription model, published-only sync, jurisdiction isolation) -> ~~Split-brain resolution~~ (done — Yjs auto-merge for content, metadata conflict UI, KB divergence detection).

### C6: Sovereign Observability & Compliance Control Plane — ~95% complete

Unified real-time dashboard for the entire stack's compliance posture. Transforms passive audit trails into active, queryable instrumentation. The connective tissue that consumes output from all other pillars and all super-pillars.

*Milestones:* ~~Metrics collection~~ -> ~~Health monitoring~~ -> ~~HTTP middleware~~ -> ~~Time-series API with adaptive bucketing~~ -> ~~Live compliance dashboard UI~~ (Canvas 2D charts, health panel, correlation search, compliance CSV/JSON export — see `modules/app/internal/admin/` and `contracts/app/observability-dashboard.md`) -> ~~Unified telemetry across all content types~~ (done — 13 metrics across 4 content types, dashboard widgets) -> ~~Anomaly detection~~ (done — z-score + rate-of-change, severity levels, alert panel with acknowledge) -> ~~Drill-down forensics~~ (done — timeline view, user correlation, event detail panel) -> ~~SIEM export~~ (done — CEF, Syslog RFC 5424, JSON Lines; push/pull modes; admin config panel).

### Sequencing

```
Super-Pillars (Product Lines)              Cross-Cutting Pillars
━━━━━━━━━━━━━━━━━━━━━━━━━━                ━━━━━━━━━━━━━━━━━━━━━
Documents ████████████████████  ~98%       C1 (AI)       ████████████████████ ~100%
KB        ████████████████████  ~98%       C2 (Audit)    ████████████████████ ~98%
Sheets    ████████████████████  ~98%       C3 (Erasure)  ████████████████████ ~100%
Slides    ████████████████████  ~98%       C4 (Workflows)████████████████████ ~100%
                                            C5 (Federation)███████████████████░ ~95%
                                            C6 (Observe)  ███████████████████░ ~95%
```

**All super-pillars at 98%, all cross-cutting pillars at 95-100%.** Remaining work is post-1.0 hardening: large document performance, element animations, plugin system.

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
