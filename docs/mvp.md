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

## MVP Scope -- Phase 2: Spreadsheets

Add a spreadsheet editor to the suite. The same architecture applies: native web format for editing, conversion service for .xlsx/.ods import/export.

- Formula engine (common Excel-compatible formulas, not the full 500+ library)
- Cell formatting, basic charts
- Real-time collaboration (same Yjs infrastructure as documents)
- Import/export .xlsx, .ods, .csv

Phase 2 does not attempt pivot tables, VBA macros, or advanced data analysis features. Those are post-1.0 territory.

---

## MVP Scope -- Phase 3: Presentations

Slide editor. Simpler than documents or spreadsheets in many ways, harder in others (layout engine, animations).

- Slide creation and editing with text, images, shapes
- Basic transitions (not animations -- transitions between slides only)
- Presenter mode with speaker notes
- Real-time collaboration
- Import/export .pptx, .odp, .pdf

Phase 3 is the smallest of the three in scope. Most organizations can live without a presentation editor longer than they can live without documents or spreadsheets.

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

### In Progress

7. **Editor Core Hardening** -- Performance optimization for large documents and many collaborators. Stress test validation ongoing.

### Remaining

8. **Conversion Service** -- LibreOffice-based microservice for import/export. User can upload a .docx and get it into the editor. User can export back to .docx.

9. **Auth + Sharing Integration** -- OpenID Connect provider integration. Link-based sharing with view/edit permissions wired end-to-end.

10. **Beta** -- Invite-only testing with real users and real documents. Bug fixing, performance tuning, format conversion quality improvements. Feedback loop before public launch.

---

## Strategic Pillars (Post-MVP)

Beyond the MVP, OpenDesk's roadmap is organized into strategic pillars that exploit sovereign/AGPL architecture as a competitive moat. These were defined via hivemind deliberation (see `decisions/2026-04-06-strategic-roadmap-segments-deliberation.md` and `decisions/2026-04-06-pillar-sequencing-deliberation.md`).

**Pillar 0: Editor Foundation** runs continuously alongside all other pillars (~30-40% of effort). The remaining pillars are sequenced by dependency:

### Pillar 1: Air-Gapped Local AI (BYOM)

Sovereign AI for organizations that cannot send data to cloud LLMs. BYOM abstraction over Ollama, pgvector in existing PostgreSQL, local RAG pipeline. Serves defense, healthcare, and legal sectors.

*Milestones:* BYOM abstraction layer -> CRDT-to-vector pipeline -> Local semantic search -> Context-aware document assistant -> Curated sovereign model zoo.

### Pillar 2: Cryptographic Audit & e-Discovery

Tamper-evident, append-only cryptographic ledger of all document mutations and access events. Merkle-tree backed. Targets pharma (FDA CFR 21 Part 11), finance (FINRA), forensics.

*Milestones:* Signed Yjs updates -> Append-only event store -> Point-in-time verifiability -> Automated SAR/FOIA engine.

### Pillar 3: Verifiable Data Erasure & CRDT Pruning

Solving the CRDT/GDPR collision -- Yjs tombstones retain deleted content, conflicting with Right to Be Forgotten. Uses structural tombstone anonymization (zero-fill payload while preserving CRDT pointers).

*Milestones:* Tombstone extraction tooling -> Structural anonymization -> Targeted redaction API -> Policy-driven automated pruning.

### Pillar 4: Sovereign Data Workflows & Process Automation

Visual workflow builder for document pipelines -- approval chains, redaction, translation, archival. All local execution via Wasm sandboxing (Extism/Wasmtime). No data leakage to external services.

*Milestones:* Trigger/action API -> Visual workflow editor -> Local service integrations -> Auditable execution logs.

### Pillar 5: Cross-Sovereign Federation

Real-time Yjs collaboration between isolated OpenDesk instances. Targets government-contractor collaboration, hospital networks, B2B consortiums. Uses CRDT sub-document partitioning for scoped federation.

*Milestones:* OIDC/SAML identity federation -> Server-to-server sync protocol -> Federated permission mapping -> Split-brain resolution.

### Pillar 6: Sovereign Observability & Compliance Control Plane

Unified real-time dashboard for the entire stack's compliance posture. Transforms passive audit trails into active, queryable instrumentation. The connective tissue that consumes output from all other pillars.

*Milestones:* Unified telemetry pipeline -> Live compliance dashboard -> Anomaly detection -> Drill-down forensics.

### Pillar Sequencing

```
Phase 0 (Complete)     Pillar 0 (Continuous)
  Role unification       Editor quality
  Module boundaries      Comments, tables, images
  Contracts 100%         Templates, search, print, a11y
        |
        v
  Pillar 4 (Workflows) ----+---- Pillar 2 (Crypto Audit)
                            |
        +-------------------+-------------------+
        v                                       v
  Pillar 6 (Observability)              Pillar 1 (Local AI)
        |                                       |
        v                                       v
  Pillar 3 (Erasure) --- depends on Pillar 2 ---+
        |
        v
  Pillar 5 (Federation) --- depends on nearly everything
```

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
