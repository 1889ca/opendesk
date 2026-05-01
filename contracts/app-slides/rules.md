# Contract: app-slides

## Purpose

Provide the presentation slide editor for OpenDesk: canvas-based element rendering (text, image, shape, table), drag/resize/rotate interactions, Yjs-backed collaborative slide editing, slide sorter, speaker notes, presenter mode, layouts, themes, slide transitions, and per-element animations (entrance, exit, emphasis effects with on-click / with-previous / after-previous triggers). This is a pure client-side rendering and interaction module with no business logic.

## Inputs

- Yjs shared document containing slide elements as `Y.Array<Y.Map<unknown>>`
- Mouse events (mousedown, mousemove, mouseup) on the slide viewport
- Keyboard events (arrow keys, Delete, Ctrl+Z/Y) on the slide viewport
- User interactions: toolbar clicks, file picker, cell editing, text editing
- `documentId` for image upload API calls (via `@opendesk/app`)

## Outputs

- Rendered HTML/CSS slide canvas with interactive elements
- Yjs mutations for element CRUD, position/size/rotation changes, content updates
- DOM overlays for selection handles, snap guides, rotation handles

## Side Effects

- Mutates Yjs shared state inside `ydoc.transact()` for undo/redo support
- Calls image upload endpoint via `@opendesk/app` utilities
- Registers/removes DOM event listeners on the slide viewport
- Opens WebSocket connection to collab via `@hocuspocus/provider`

## Invariants

1. **Coordinate system is percentage-based.** All element positions and sizes are stored as percentages (0-100) of the slide viewport.

2. **Transforms are undoable.** Every interaction operation is wrapped in `ydoc.transact()`.

3. **All element types support interaction.** Every rendered element uses `.slide-element` class and `data-element-id` attribute.

4. **No business logic.** This module handles rendering and interaction geometry only.

5. **No mock data.** Images use real upload. Table cells contain real user input.

6. **Minimum element size.** Elements cannot be resized below 2% width or 2% height.

7. **Aspect ratio lock with Shift.** Shift during resize preserves original aspect ratio.

8. **Z-order maps to array position.** Element rendering order is determined by Yjs array index.

9. **Animations live on the slide.** Per-element animations are stored in a `Y.Array` on the slide map (keyed `'animations'`), in playback order. Each row references the target by `elementId`. Removing an element removes its animations on the next observe pass.

10. **Animation steps drive presenter advancement.** A presenter "next" key first advances through the current slide's animation steps (each `on-click` opens a new step; `with-previous` and `after-previous` join the open step). Only after the last step does navigation move to the next slide.

11. **Image src must be http(s) or relative /uploads/.** `SlideElementSchema.src` is validated with a `refine` that rejects any other scheme (e.g. `javascript:`, `data:`, `blob:`, `file:`). `parse-elements.ts` applies the same check on read; `yjs-element-insert.ts` throws on insert. `render-image.ts` guards the final DOM assignment.

12. **Rich text content is sanitized on write and read.** `sanitizeRichTextHtml` (browser DOMParser, no external deps) is applied before storing content to Yjs and before loading it into TipTap. Only TipTap StarterKit + Underline tags are allowed; all event-handler attributes and non-allowlisted tags are stripped.

13. **Tables clamped to MAX_TABLE_ROWS × MAX_TABLE_COLS.** `MAX_TABLE_ROWS = 50` and `MAX_TABLE_COLS = 20` are exported from `contract.ts`. `createTableElement` clamps on create; `parseTableData` clamps on read; `parse-elements.ts` clamps after parsing. Cell strings are capped at 8 KB.

## Dependencies

- `@opendesk/app` (compile-time) — `uploadImage`, `validateImageFile`, `extractImageFiles`, `getUserIdentity`, `getDocumentId`, `setupTitleSync`
- `yjs` (runtime) — Yjs shared types for collaborative element state
- `@hocuspocus/provider` (runtime) — WebSocket transport for Yjs sync
- `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-underline` (runtime) — rich text editing in slide elements

## Boundary Rules

### MUST

- Convert all pixel coordinates to percentage-based coordinates before applying transforms
- Wrap all Yjs mutations in `ydoc.transact()` for undo/redo atomicity
- Enforce minimum element size (2% x 2%) during resize
- Render all element types with `.slide-element` class and `data-element-id`
- Reuse `@opendesk/app` image upload utilities (never duplicate)
- Keep every file under 200 lines
- Use modern CSS (no Tailwind)

### MUST NOT

- Import server-side modules (api, auth, storage, etc.)
- Use mock data or placeholder URLs
- Store snap guides or selection state in Yjs
- Mutate Yjs state outside of `ydoc.transact()` calls
- Exceed 200 lines per file

## File Structure

```
modules/app-slides/
  index.ts                    — Public API: schemas, types
  contract.ts                 — Zod schemas for slide elements
  internal/
    presentation-editor.ts    — Entry point: Hocuspocus setup, slide management
    types.ts                  — Runtime types and constants
    element-factory.ts        — Factory functions for new elements
    element-renderer.ts       — Dispatcher to type-specific renderers
    element-interaction.ts    — Interaction controller: drag/resize/rotate/select
    drag-handler.ts           — Drag-to-move with snap
    resize-handler.ts         — Resize with aspect ratio lock
    rotate-handler.ts         — Rotation via handle
    snap-engine.ts            — Snap-to-grid and snap-to-element
    selection-manager.ts      — Single/multi select, marquee
    z-order.ts                — Z-index management
    interaction-overlay.ts    — Selection handles, snap guides
    render-text.ts            — Text element renderer
    render-image.ts           — Image element renderer
    render-shape.ts           — Shape element renderer (SVG)
    render-table.ts           — Table element renderer
    tiptap-mini-editor.ts     — Lightweight TipTap factory
    text-edit-controller.ts   — Text editing mode management
    text-format-toolbar.ts    — Formatting toolbar UI
    insert-toolbar.ts         — Insert toolbar with shape/table pickers
    slide-image-upload.ts     — Image upload bridge
    yjs-element-insert.ts     — Yjs insertion helpers
    yjs-mutations.ts          — Yjs field update helpers
    parse-elements.ts         — Parse Yjs maps to typed objects
    layouts.ts                — Slide layout definitions
    themes.ts                 — Theme definitions
    layout-theme-init.ts      — Layout/theme initialization
    layout-picker.ts          — Layout picker UI
    theme-picker.ts           — Theme picker UI
    transitions.ts            — Slide transition effects
    slide-sorter.ts           — Slide thumbnail sorter
    speaker-notes.ts          — Speaker notes panel
    presenter-mode.ts         — Fullscreen presenter mode
    toolbar-extras.ts         — Additional toolbar controls
    animation-types.ts        — Animation effect catalog and trigger types
    animation-yjs.ts          — Yjs read/write helpers and step-builder for element animations
    animation-engine.ts       — Web Animations playback engine (entrance/exit/emphasis)
    animation-panel.ts        — Sidebar UI for managing element animations
    animation-panel-controls.ts — Small DOM control factories for the animation panel
    animation-init.ts         — Mounts the animation panel and toolbar toggle
    css/
      presentation.css        — Presentation editor styles
      animations.css          — Animation panel styles
```

## Verification

1. **Percentage coordinates** — Unit test: pixel-to-percent conversion.
2. **Snap engine** — Unit test: snap targets and guide lines.
3. **Resize constraints** — Unit test: minimum size, aspect ratio lock.
4. **Z-order** — Unit test: reordering operations.
5. **Selection manager** — Unit test: Shift+click toggle, marquee intersection.
6. **Renderer dispatch** — Each element type produces correct DOM with class/dataset.
7. **Image upload** — File picker triggers upload, URL stored in Yjs.
8. **Table grid** — Correct rows/cols. Cell edits write to Yjs.
9. **Insert toolbar** — Each button inserts correct element type.
10. **Build** — `npm run build` succeeds with updated entry points.
11. **Animation Yjs round-trip** — Append, update, remove, move, and prune helpers preserve schema and order (`animation-yjs.test.ts`).
12. **Animation step grouping** — `buildAnimationSteps` opens a new step on each on-click, groups with-previous and after-previous into the open step (`animation-yjs.test.ts`).
13. **Animation engine** — `keyframesFor`, `prepareInitialState`, `runStep` (sequential after-previous), and `createAnimationController` (advance/done/reset) behave as specified (`animation-engine.test.ts`).
