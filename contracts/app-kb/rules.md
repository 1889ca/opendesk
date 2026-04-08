# Contract: app-kb

## Purpose

Provide the Knowledge Base browser UI for OpenDesk: entry listing with grid/list views, filtering, search, detail panels, entry creation/editing forms, graph visualization, snapshot management, and quick notes. This is a SPA view module loaded by the app shell router.

## Inputs

- API responses from KB endpoints (`/api/kb/entries`, `/api/kb/entries/:id`, etc.)
- User interactions: filter selection, search input, entry clicks, form submissions
- URL parameters for filter state persistence

## Outputs

- Rendered HTML KB browser with entry list, detail panel, form overlay
- HTTP requests to KB API endpoints via `@opendesk/app` apiFetch
- ViewModule interface (mount/unmount) for SPA shell integration

## Side Effects

- HTTP requests to KB API endpoints
- URL manipulation for filter state
- DOM manipulation for entry list, detail panel, forms

## Invariants

1. **No business logic.** Renders API data only.
2. **No mock data.** Real API responses only.
3. **Filter state in URL.** Filters persist across navigation via URL params.

## Dependencies

- `@opendesk/app` (compile-time) — `apiFetch`

## Boundary Rules

### MUST

- Keep every file under 200 lines
- Use modern CSS (no Tailwind)
- Persist filter state in URL parameters

### MUST NOT

- Import server-side modules
- Use mock data
- Exceed 200 lines per file

## File Structure

```
modules/app-kb/
  index.ts                — Public API: createEntryApi, fetchEntries, mount/unmount
  contract.ts             — Module marker
  internal/
    kb-browser-view.ts    — ViewModule mount/unmount entry point
    kb-api.ts             — KB API client (CRUD operations)
    kb-snapshot-api.ts    — Snapshot API client
    filter-bar.ts         — Filter bar UI and URL state
    entry-list.ts         — Entry list rendering (grid/list views)
    entry-detail.ts       — Detail panel rendering
    entry-card.ts         — Entry card component
    entry-form.ts         — Create/edit entry form
    form-meta-fields.ts   — Form metadata field components
    detail-metadata.ts    — Detail panel metadata section
    detail-dataset.ts     — Detail panel dataset section
    detail-relationships.ts — Detail panel relationships section
    graph-data.ts         — Graph visualization data preparation
    graph-layout.ts       — Graph layout algorithm
    graph-panel.ts        — Graph panel UI
    graph-renderer.ts     — Graph rendering
    quick-note.ts         — Quick note creation
    snapshot-panel.ts     — Snapshot management panel
    pinned-section.ts     — Pinned entries section
    simple-markdown.ts    — Simple markdown renderer
```
