# Contract: app/slides-element-types

## Purpose

Provide element type renderers, factories, and insert UI for the slide editor. Supports text, image, shape, and table element types, all integrated with the existing interaction system (drag, resize, rotate, snap, multi-select, z-order).

## Inputs

- `SlideElement` objects parsed from Yjs shared state, including type-specific fields (src, shapeType, fill, stroke, strokeWidth, tableData)
- User interactions: toolbar clicks to insert elements, file picker / drag-and-drop for images, cell editing for tables
- `documentId` for image upload API calls

## Outputs

- DOM elements rendered into the slide viewport for each element type
- New Yjs element maps inserted via the element factory + insert functions
- Content/cell updates written back to Yjs on blur events
- Insert toolbar DOM element attached to the presentation header

## Side Effects

- Calls the `/api/upload` endpoint for image uploads (reuses existing image-upload module)
- Mutates Yjs shared element maps inside `ydoc.transact()` for element insertion and content updates
- Renders DOM elements and toolbar UI into the slide viewport and header

## Invariants

1. **All element types support interaction.** Every rendered element uses the `.slide-element` class and `data-element-id` attribute, making it compatible with the existing interaction controller (drag, resize, rotate, snap, select).

2. **Percentage-based positioning.** All element positions and sizes use the same percentage coordinate system (0-100) as the interaction system.

3. **Yjs transactional updates.** All element insertions and content updates are wrapped in `ydoc.transact()` for undo/redo atomicity.

4. **No mock data.** Images use real upload to S3-compatible storage. Table cells contain real user input.

5. **Shape SVG is non-interactive.** SVG shapes render as visual backgrounds; the text overlay on top captures user input.

6. **Table cell dimensions match metadata.** `TableData.cells` array dimensions always match `rows x cols`.

## Dependencies

- `./types.ts` (sibling) -- `SlideElement`, `ShapeType`, `TableData` types
- `../image-upload.ts` (parent module) -- `uploadImage`, `validateImageFile`, `extractImageFiles`
- `yjs` (runtime) -- Yjs shared types for element insertion and mutation
- `./element-interaction.ts` (sibling) -- interaction controller consumes rendered elements

## Boundary Rules

### MUST

- Render all element types with `.slide-element` class and `data-element-id` for interaction compatibility
- Use percentage-based positioning matching the interaction system
- Wrap all Yjs mutations in `ydoc.transact()`
- Reuse existing `image-upload.ts` for image file handling
- Keep every file under 200 lines
- Use modern CSS (no Tailwind)
- Store all element data in Yjs for real-time sync

### MUST NOT

- Import server-side modules (api, auth, storage, etc.)
- Use mock data or placeholder URLs for images
- Break the interaction system's coordinate model
- Exceed 200 lines per file
- Render elements without the required class/dataset attributes

## File Structure

```
modules/app/internal/slides/
  types.ts              -- Extended with ShapeType, TableData
  element-renderer.ts   -- Dispatcher: routes element to type-specific renderer
  render-text.ts        -- Text element renderer (contentEditable)
  render-image.ts       -- Image element renderer (img tag)
  render-shape.ts       -- Shape element renderer (SVG + text overlay)
  render-table.ts       -- Table element renderer (HTML table with editable cells)
  element-factory.ts    -- Factory functions for creating new elements
  insert-toolbar.ts     -- Insert toolbar UI with shape submenu and table grid picker
  slide-image-upload.ts -- Image upload bridge for slide editor
  yjs-element-insert.ts -- Yjs insertion and table cell update functions
  parse-elements.ts     -- Parse Yjs maps into typed SlideElement objects
  element-types.css     -- Styles for all element types and insert toolbar
```

## Verification

1. **Renderer dispatch** -- Each element type produces a DOM element with correct class and dataset attributes.
2. **Image upload** -- File picker triggers upload, returned URL is stored in Yjs element.
3. **Shape SVG** -- Each shape type produces valid SVG with correct fill/stroke attributes.
4. **Table grid** -- Table renders correct number of rows and columns. Cell edits write to Yjs.
5. **Insert toolbar** -- Each button inserts the correct element type into Yjs.
6. **Interaction compatibility** -- Inserted elements can be dragged, resized, rotated, selected.
