# Contract: diagrams

## Purpose

Vector diagramming editor (Visio / draw.io parity): compose flowcharts, org charts, network diagrams, BPMN, sequence diagrams, and ER diagrams using a shape library, connectors that auto-route, multi-page canvases, and layered export to SVG, PNG, and PDF. Diagrams are first-class OpenDesk content with their own editor URL (`/diagram/:id`) and Yjs-backed co-authoring.

Diagrams embed into `Documents` and `Slides` as live references (edit once, updates propagate) via the `kb` reference-resolution mechanism — a diagram is a KB entry of type `diagram`.

## Inputs

- User actions: add shape, drag, resize, rotate, connect, edit text, change style, change layer
- `DiagramDefinition` JSON (persisted as Yjs doc): shapes, connectors, layers, pages, style tokens
- Shape library: built-in (flowchart, BPMN, network, UML) plus workspace-provided custom libraries

## Outputs

- `DiagramDefinition` persisted to `storage`
- Rendered SVG for embedding and export; rasterized PNG via server-side renderer; PDF via `convert`
- KB entry of type `diagram` with render preview for inclusion in other content types
- `DiagramUpdated` event on save

## Side Effects

- Yjs co-authoring via the existing `collab` infrastructure
- Writes to `storage`
- Server-side SVG→PNG rasterization on export (headless renderer; no external fonts fetched)
- Emits events via `events`; audits via `audit`
- Registers a KB entry on first save; updates the entry on subsequent saves

## Invariants

1. **Vector-native.** Diagrams are stored as structured shapes and connectors, not as rasterized pixels. PNG is only a derivative.
2. **Deterministic rendering.** The same `DiagramDefinition` MUST produce byte-identical SVG output given the same shape library version. Server and client renderers share a pinned rendering spec.
3. **Connectors are logical.** A connector references source and target shape IDs, not coordinates. Moving a shape updates the connector automatically. Dangling connectors (source or target missing) render as red dashed placeholders and surface a validator warning.
4. **Layer ordering is explicit.** Every shape belongs to exactly one layer; z-order within a layer is explicit. No implicit z-index based on insertion order.
5. **Style tokens.** Colors, fonts, and stroke widths reference workspace style tokens (shared with Slides themes). Changing a token updates all diagrams consistently.
6. **Bounded shape counts.** A single diagram page caps at 2,000 shapes (performance guardrail). Multi-page diagrams spread beyond this.
7. **No external font fetches.** Rendered SVG/PNG uses embedded fonts only; external `@font-face` URLs are stripped on export.
8. **KB sync.** The diagram's KB entry is updated atomically with the save; the entry carries the SVG preview, not the full definition.
9. **Accessibility.** Every shape supports an `alt_text` field. Exports include `<title>` and `<desc>` per shape for screen readers.

## Dependencies

- `core`
- `storage`
- `collab` — Yjs co-authoring
- `events`
- `audit`
- `kb` — diagrams appear as KB entries of type `diagram`; enables insertion into Documents/Slides via existing pickers
- `convert` — PDF export
- `app-admin/policy` — export-format allowlist, size caps

## Boundary Rules

### MUST

- Persist shapes with stable IDs (connectors resolve by ID, never by index)
- Round-trip SVG export without loss of logical structure (`DiagramDefinition → SVG → DiagramDefinition` via import recovers an equivalent document, up to style-token resolution)
- Use the same stable-block-ID targeting pattern as `collab` intents for any agent-driven edits
- Strip external resource URLs on export
- Keep every file under 200 lines; shape renderers live in per-type files

### MUST NOT

- Store diagrams as flattened SVG blobs (structured JSON only)
- Fetch external shape libraries at render time (all libraries are workspace-registered and cached)
- Depend on browser-only APIs in the server-side renderer (use a headless SVG engine or a pinned rasterizer)
- Embed arbitrary HTML in shapes (use a restricted text-formatting subset shared with Slides)

## Verification

1. **Shape ID stability** — create connector between A and B, delete and recreate A at the same visual position (different ID), assert connector reports dangling.
2. **Deterministic render** — render the same definition on client and server, assert byte-identical SVG (after whitespace normalization).
3. **No external fetch** — export diagram referencing `@font-face` URL, monitor renderer network, assert no outbound request.
4. **Layer order** — create shapes A and B with explicit z-order, assert render respects it regardless of insertion order.
5. **Token propagation** — change accent style token, re-render existing diagram, assert shapes using that token update.
6. **Shape cap** — attempt to add the 2,001st shape to a page, assert refused with `CAPACITY`.
7. **KB sync atomicity** — save diagram, query KB entry, assert preview and revision match within the same transaction.
8. **Accessibility** — export diagram with alt text, assert `<title>` / `<desc>` present in SVG.

## MVP Scope

Implemented (targeted):
- [ ] `DiagramDefinition` Zod schema
- [ ] Yjs-backed co-authoring
- [ ] Built-in shape libraries: flowchart, BPMN-lite, network, UML class
- [ ] Auto-routing connectors (orthogonal, straight)
- [ ] Multi-page diagrams
- [ ] SVG/PNG/PDF export
- [ ] KB entry registration
- [ ] Insertion pickers in Documents and Slides

Post-MVP (deferred):
- [ ] Full BPMN 2.0 validation
- [ ] Swimlane auto-layout
- [ ] Live data binding (diagrams that read from KB datasets)
- [ ] Animated diagrams
- [ ] Third-party shape library federation
