# Contract: app/workspace-sidebar

## Purpose

Provide a collapsible left navigation panel showing workspace content: recently opened documents, starred documents, folder tree, and quick search.

## Components

- `shared/workspace-sidebar.ts` — Sidebar builder and collapse toggle
- `shared/sidebar-sections.ts` — Section data loaders (recent, starred, folders)
- `public/workspace-sidebar.css` — Sidebar layout and styling

## Invariants

1. Collapse state persisted in `localStorage` as `opendesk-sidebar-collapsed`.
2. Recent documents tracked in `localStorage` (max 8 entries).
3. Starred documents fetched from `/api/starred` (PostgreSQL-backed).
4. Folder tree loaded from `/api/folders` with max 2 levels of recursion.
5. Quick search filters visible items by text content (client-side filtering).
6. Hidden on screens narrower than 768px.

## API Dependencies

- `GET /api/starred` — list starred documents for the user
- `POST /api/starred/:documentId` — star a document
- `DELETE /api/starred/:documentId` — unstar a document
- `GET /api/folders` — list folders (existing)
