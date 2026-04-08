# Contract: app/slides-interaction

## Purpose

Provide drag-to-move, resize, rotate, snap-to-grid/element, multi-select, z-index ordering, and keyboard nudge interactions for slide canvas elements in the OpenDesk Presentation Editor.

## Inputs

- Mouse events (mousedown, mousemove, mouseup) on the slide viewport and its child elements
- Keyboard events (arrow keys, Shift+arrow, Delete, Ctrl+Z/Y) on the slide viewport
- `SlideElement[]` — the current set of elements on the active slide, sourced from Yjs shared state
- `viewportRect: DOMRect` — the slide viewport bounding box for coordinate conversion
- Grid size configuration (default 10px logical units)

## Outputs

- `Transform` updates — position (x, y), size (width, height), and rotation (degrees) changes applied back to Yjs element maps
- `SnapGuide[]` — visual guide lines for rendering snap indicators
- `string[]` — selected element IDs for highlighting/handle rendering
- Z-index reordering commands applied to Yjs element arrays

## Side Effects

- Mutates Yjs shared element maps (x, y, width, height, rotation) inside `ydoc.transact()` for undo/redo support
- Registers and removes DOM event listeners on the slide viewport
- Renders/removes CSS-styled selection handles, rotation handles, and snap guide overlays

## Invariants

1. **Coordinate system is percentage-based.** All element positions and sizes are stored as percentages of the slide viewport (0-100). Mouse pixel coordinates are converted to percentages using the viewport's DOMRect.

2. **Transforms are undoable.** Every drag, resize, and rotate operation is wrapped in a single `ydoc.transact()` call, making it a single undo step. Keyboard nudges are also transacted.

3. **Aspect ratio lock with Shift.** When Shift is held during resize, the element's original aspect ratio is preserved. Without Shift, free-form resize is allowed.

4. **Snap guides are visual-only.** Snap calculations influence the final position/size but snap guides are purely decorative overlays. They do not persist in document state.

5. **Multi-select is additive with Shift.** Shift+click adds/removes individual elements from the selection. Click without Shift replaces the selection. Marquee (rubber-band) selection selects all elements whose bounding boxes intersect the marquee rectangle.

6. **Z-order maps to array position.** Element rendering order is determined by array index in the Yjs elements array. "Bring to front" moves an element to the end; "send to back" moves it to index 0.

7. **Minimum element size.** Elements cannot be resized below 2% width or 2% height to prevent invisible elements.

8. **No business logic.** This module handles interaction geometry only. It does not validate element content, enforce permissions, or communicate with the API.

## Dependencies

- `yjs` (runtime) — Yjs shared types for transactional element mutation
- `presentation-editor.ts` (parent) — provides the Yjs document, slide data, and viewport DOM element
- No server-side dependencies. This is a pure client-side interaction layer.

## Boundary Rules

### MUST

- Convert all pixel coordinates to percentage-based coordinates before applying transforms
- Wrap all Yjs mutations in `ydoc.transact()` for undo/redo atomicity
- Enforce minimum element size (2% x 2%) during resize
- Support Shift+resize for aspect ratio lock
- Support Shift+click for additive multi-select
- Support arrow key nudge (1% default, 10% with Shift) for selected elements
- Clean up all event listeners when the interaction controller is destroyed
- Use modern CSS for handles, guides, and selection visuals (no Tailwind)
- Keep every file under 200 lines

### MUST NOT

- Store snap guides or selection state in the Yjs document
- Import server-side modules (api, auth, storage, etc.)
- Use mock data in tests — use real coordinate fixtures
- Exceed 200 lines per file
- Mutate Yjs state outside of `ydoc.transact()` calls

## File Structure

```
modules/app/internal/slides/
  types.ts              — SlideElement, Transform, BoundingBox, SnapGuide, HandlePosition types
  element-interaction.ts — Main interaction controller, event listener setup/teardown
  drag-handler.ts       — Drag-to-move logic with snap integration
  resize-handler.ts     — Resize logic with aspect ratio lock and minimum size
  rotate-handler.ts     — Rotation logic via rotation handle
  snap-engine.ts        — Snap-to-grid and snap-to-element guide calculations
  selection-manager.ts  — Single/multi select, marquee rectangle selection
  z-order.ts            — Z-index management (bring forward, send back, etc.)
```

## Verification

1. **Percentage coordinates** — Unit test: given a viewport rect and pixel coordinates, assert conversion produces correct percentages.
2. **Snap engine** — Unit test: given element positions and a grid size, assert correct snap targets and guide lines are produced.
3. **Resize constraints** — Unit test: assert minimum size enforcement. Assert aspect ratio lock produces correct dimensions.
4. **Z-order** — Unit test: given an array of elements and an operation (bring forward, send back, etc.), assert correct reordering.
5. **Selection manager** — Unit test: assert Shift+click toggle, single click replace, marquee intersection logic.
6. **Rotation** — Unit test: given center point and mouse positions, assert correct angle calculation.
7. **Keyboard nudge** — Unit test: assert 1% nudge default, 10% with Shift, clamped to 0-100 range.
