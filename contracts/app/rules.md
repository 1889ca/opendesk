# Contract: app

## Purpose

Provide the frontend shell for OpenDesk: the HTML document, modern CSS styles, JavaScript application code, TipTap editor with Yjs collaboration, awareness UI, document management, sharing, import/export, and bilingual (EN/FR) user interface. This module is the user-facing surface. It renders state, dispatches user actions to backend modules via `api`, and maintains real-time editing state via the Hocuspocus WebSocket protocol. It contains no business logic.

## Inputs

- User interactions: keyboard, mouse, touch events within the editor and management UI
- `api` module responses: REST responses and SSE event streams for document metadata, permission checks, user info
- `collab` WebSocket connection: Yjs document updates, awareness state broadcasts via Hocuspocus client protocol
- `document` module types (compile-time): `TextDocumentSnapshot`, `ProseMirrorJSON`, `TextSchemaVersion`, `DocumentIntent`, `IntentAction` variants, and all associated Zod schemas — imported for type safety and schema parity enforcement
- User locale preference: resolved at load time to `'en'` or `'fr'`

## Outputs

- Rendered HTML/CSS UI: editor surface, document list, share dialog, import/export controls, awareness indicators (cursors, presence)
- HTTP requests to `api` endpoints: document CRUD, permission queries, import/export, intent submission
- WebSocket messages to `collab` via Hocuspocus client: Yjs sync protocol messages, awareness updates (cursor position, selection, user metadata)
- `DocumentIntent` payloads: constructed in the frontend when agents or system features need to submit structured intents via the `api` module

## Side Effects

- Opens and maintains a WebSocket connection to the `collab` module's Hocuspocus endpoint for each active document editing session
- Sends HTTP requests to `api` endpoints for all non-realtime operations
- Subscribes to SSE streams from `api` for live updates (document list changes, permission changes)
- Reads and writes user locale preference to browser `localStorage`
- Reads user role/permissions from `api` responses to determine which UI features to show or hide

## Invariants

1. **ProseMirror schema parity.** The TipTap editor schema (node types, marks, and their attributes) MUST match the `document` module's `TextDocumentSnapshot` schema exactly. Every node type and mark type defined in `document` has a corresponding TipTap extension in `app`. Every attribute defined in `document` is configured in the TipTap extension. No TipTap extensions define node types or marks that `document` does not recognize.

2. **Block ID preservation.** The TipTap editor MUST preserve `attrs.blockId` (UUIDv4) on all top-level block nodes. New blocks created by user action MUST be assigned a fresh UUIDv4 `blockId` at creation. Block IDs are never reassigned or mutated.

3. **i18n completeness.** Every user-visible string has both an `en` and `fr` translation key. The build MUST fail if any component defines a key in one locale without a corresponding key in the other.

4. **No business logic.** The app module renders state and dispatches actions. Validation, authorization enforcement, conflict resolution, and data transformation are performed by backend modules. The app displays the results.

5. **Permission-driven UI.** UI features (edit, share, delete, import, export) are shown or hidden based on the user's role as reported by the `api` module. The app never grants capabilities locally — it reflects what the backend permits.

6. **Single WebSocket per document.** For a given document editing session, the app opens exactly one Hocuspocus WebSocket connection. Reconnection logic handles disconnects, but never results in duplicate concurrent connections to the same document.

7. **Awareness state is ephemeral.** Collaborative cursor positions, user presence indicators, and selection highlights are derived from `y-protocols/awareness` state. They are never persisted, cached, or sent to the `api` module.

8. **Locale is deterministic.** The resolved locale (`'en'` or `'fr'`) is fixed at page load from `localStorage` or browser language preference. It does not change during a session unless the user explicitly switches, which triggers a full re-render.

## Dependencies

- `document` (compile-time and test-time) — ProseMirror schema types, `TextDocumentSnapshot`, `ProseMirrorJSON`, Zod schemas, `TextSchemaVersion`. The app imports these for type safety and schema parity testing. This is a build dependency, not a runtime server import.
- `api` (runtime) — REST endpoints and SSE streams for all backend communication. The app is an HTTP/SSE client of `api`. No direct module import; communication is over the network.
- `collab` (runtime) — WebSocket connection for real-time collaborative editing. The app connects via the Hocuspocus client protocol (`@hocuspocus/provider`). No direct module import; communication is over WebSocket.

## Boundary Rules

### MUST

- Maintain ProseMirror schema parity with the `document` module's `TextDocumentSnapshot`. When `document` adds a node type or mark, `app` adds a corresponding TipTap extension. This is enforced by an automated schema parity test.
- Use `@tiptap/extension-collaboration` for binding TipTap to the Yjs shared document.
- Use `@tiptap/extension-collaboration-cursor` with `y-protocols/awareness` for rendering collaborative cursors and presence indicators.
- Use `@hocuspocus/provider` as the WebSocket transport for Yjs synchronization.
- Assign a UUIDv4 `blockId` attribute to every new top-level block node created in the editor.
- Support `en` and `fr` locales from day one. Translation keys are co-located with their components (not in a centralized file). The build produces separate EN and FR bundles.
- Use modern CSS for all styling. No utility-class frameworks, no preprocessors.
- Show or hide UI features based on the user's permission set as returned by `api`. Never hard-code role checks; consume the permission payload.
- Communicate with backend exclusively through `api` (HTTP/SSE) and `collab` (WebSocket). No direct imports of server-side modules.

### MUST NOT

- Import any server-only module (`collab` internals, `storage`, `auth`, `permissions`, `events`). All server interaction goes through `api` endpoints or the Hocuspocus WebSocket protocol.
- Implement business logic. No document validation, no permission enforcement, no conflict resolution, no data migration. The app is a rendering and interaction layer.
- Use mock data for any purpose: not in components, not in tests, not in storybook-style demos. Use real API responses or real test fixtures from the `document` module's schemas.
- Use Tailwind CSS, SCSS, or any CSS preprocessor. Modern CSS only.
- Use centralized i18n files. Translation keys live alongside the components that use them.
- Persist awareness state (cursors, presence). It is transient WebSocket-derived data.
- Open multiple concurrent WebSocket connections to the same document.
- Assume a specific user role. All capability checks derive from the permission payload returned by `api`.
- Define ProseMirror node types or marks that are not declared in the `document` module's schema. The `document` module is the single source of truth for the content schema.

## Verification

How to test each invariant:

1. **Schema parity** — Automated test: import the `document` module's node type registry and mark type registry. Import the app's TipTap extension list. Assert a 1:1 mapping: every document node type has a TipTap extension with matching `name` and `attrs`. Every TipTap extension corresponds to a document node type. This test runs in CI on every commit.

2. **Block ID preservation** — Integration test: create a document, add several block nodes via user simulation, serialize to JSON, assert every top-level node has a valid UUIDv4 `attrs.blockId`. Delete and re-add blocks, assert new blocks get fresh IDs and no ID collisions occur.

3. **i18n completeness** — Build-time check: a build step enumerates all translation key files across all components. For every key present in `en`, assert a corresponding key exists in `fr`, and vice versa. The build fails on any mismatch. This is a hard gate, not a warning.

4. **No business logic** — Code-level audit: grep the app module source for patterns indicating business logic (Zod `.parse()` calls on request bodies, permission evaluation functions, conflict resolution algorithms). Assert zero matches. Contract review: no function in the app module accepts raw database records or returns mutation results.

5. **Permission-driven UI** — Integration test: render the document management UI with different permission payloads (viewer, editor, owner). Assert that restricted features (delete button, share dialog, export option) are absent from the DOM when the permission payload does not include the corresponding capability.

6. **Single WebSocket per document** — Integration test: open a document for editing, simulate a disconnect and reconnect cycle. Assert that at no point are two WebSocket connections to the same document endpoint open simultaneously.

7. **Awareness state ephemerality** — Unit test: assert that no awareness data (cursor positions, user presence) is written to `localStorage`, `sessionStorage`, IndexedDB, or sent to any `api` endpoint.

8. **Locale determinism** — Unit test: set `localStorage` locale to `'fr'`, load the app, assert all rendered strings use FR translations. Switch locale, assert a full re-render occurs. Assert no partial-locale states are possible.

## File Structure

```
modules/app/
  index.html             -- HTML shell
  main.ts                -- Application entry point, locale resolution, editor init
  contract.ts            -- Re-exports document module types used by the app (schema parity surface)
  editor/
    extensions.ts         -- TipTap extension registry (maps 1:1 to document schema)
    collaboration.ts      -- @tiptap/extension-collaboration + Hocuspocus provider setup
    awareness.ts          -- Cursor/presence UI via y-protocols/awareness
    block-id.ts           -- blockId generation and preservation extension
  ui/
    document-list/        -- Document list/management UI + co-located i18n keys
    share-dialog/         -- Share dialog UI + co-located i18n keys
    import-export/        -- Import/export controls + co-located i18n keys
    permissions/          -- Permission-aware UI wrappers (show/hide based on role)
  i18n/
    resolve.ts            -- Locale resolution logic (localStorage, browser preference)
    types.ts              -- Translation key type definitions
  api/
    client.ts             -- HTTP/SSE client for api module endpoints
    types.ts              -- Response types (mirrors api contract)
  styles/
    *.css                 -- Modern CSS, no preprocessors, no utility frameworks
```

## Sub-Contracts

- `contracts/app/comments.md` — Comment marks, sidebar, replies, and comment store
- `contracts/app/suggestions.md` — Track changes / suggestion mode, suggestion marks and sidebar
- `contracts/app/search.md` — Find-and-replace with regex support, ReDoS protection, ProseMirror decorations
- `contracts/app/print.md` — Print stylesheet, PageBreak node, print/PDF buttons
- `contracts/app/accessibility.md` — ARIA announcer, roving tabindex toolbar, shortcut dialog
- `contracts/app/mobile.md` — Touch support, responsive toolbar overflow, viewport management

## MVP Scope

Implemented:
- [x] HTML shell and application entry point
- [x] TipTap editor with Yjs collaboration (`@tiptap/extension-collaboration`)
- [x] Hocuspocus WebSocket provider for real-time sync
- [x] Awareness protocol (collaborative cursors, user presence)
- [x] Document list/management UI
- [x] Share dialog UI
- [x] Import/export controls
- [x] Formatting toolbar
- [x] User identity display
- [x] Modern CSS (no Tailwind, no preprocessors)
- [x] No business logic in app module
- [x] Single WebSocket per document
- [x] Awareness state is ephemeral (never persisted)
- [x] i18n: EN and FR locales supported
- [x] Centralized translation keys with TypeScript enforcement
- [x] Find and replace (see `contracts/app/search.md`)
- [x] Print/PDF support (see `contracts/app/print.md`)
- [x] Accessibility features (see `contracts/app/accessibility.md`)
- [x] Mobile/touch support (see `contracts/app/mobile.md`)

Post-MVP (deferred):
- [ ] Block ID assignment extension (`blockId` UUIDv4 on new top-level blocks) — blocks exist but auto-ID assignment extension not yet built
- [ ] Permission-driven UI (show/hide features based on role from `api`) — currently all features visible regardless of role
- [ ] Modular file structure (editor/extensions.ts, editor/collaboration.ts, etc.) — currently in a flatter structure
- [ ] ProseMirror schema parity test (automated 1:1 mapping check against `document` module)

Decided against:
- Co-located translation keys — centralized keys with TypeScript enforcement preferred (better DX for a small team)
