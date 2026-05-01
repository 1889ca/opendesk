# Contract: app-sheets

## Purpose

Provide the spreadsheet editor for OpenDesk: grid rendering, cell editing, formula bar, multi-sheet tabs, cell formatting (bold, italic, colors, number formats, borders), conditional formatting, column/row operations, clipboard, sorting, filtering, range selection, and collaborative presence. This is a pure client-side rendering and interaction module with no business logic.

## Inputs

- Yjs shared document containing sheet data as `Y.Map` of `Y.Array<Y.Array<string>>`
- User interactions: cell clicks, keyboard input, toolbar clicks, tab clicks, context menus
- Formula strings for cell evaluation
- `documentId` for document title sync (via `@opendesk/app`)

## Outputs

- Rendered HTML spreadsheet grid with editable cells
- Yjs mutations for cell values, formatting, sheet CRUD
- Format toolbar DOM elements
- Tab bar DOM elements for sheet management
- Conditional formatting visual overlays

## Side Effects

- Mutates Yjs shared state inside `ydoc.transact()` for undo/redo
- Opens WebSocket connection to collab via `@hocuspocus/provider`
- Registers DOM event listeners for keyboard shortcuts, mouse interactions
- Dispatches custom events (`opendesk:sheet-switch`)

## Invariants

1. **Format data syncs via Yjs.** All formatting changes replicate to collaborators automatically.
2. **Raw values are preserved.** Number formatting changes display only; underlying values unchanged.
3. **At least one sheet.** Deleting the last sheet is prevented.
4. **Unique sheet IDs.** IDs are never reused within a document.
5. **Yjs-transacted mutations.** All mutations occur inside `ydoc.transact()`.
6. **Migration safety.** Legacy single-sheet documents auto-migrate to multi-sheet model.
7. **No business logic.** Rendering and interaction only.
8. **No mock data.** Real cell values and formulas only.

## Dependencies

- `@opendesk/app` (compile-time) — `getUserIdentity`, `getDocumentId`, `setupTitleSync`
- `yjs` (runtime) — Yjs shared types for collaborative cell/sheet state
- `@hocuspocus/provider` (runtime) — WebSocket transport for Yjs sync

## Boundary Rules

### MUST

- Wrap all Yjs mutations in `ydoc.transact()`
- Keep every file under 200 lines
- Use modern CSS (no Tailwind)
- Preserve raw cell values when applying display formatting

### MUST NOT

- Import server-side modules
- Use mock data
- Exceed 200 lines per file
- Mutate Yjs state outside of `ydoc.transact()` calls

## Sub-Contracts

- `contracts/sheets-formatting/rules.md` — Cell formatting types, toolbar, rendering, shortcuts
- `contracts/sheets-tabs/rules.md` — Multi-sheet tab management, cross-sheet references
- Pivot Tables (inline) — Multi-value pivot engine, 9 aggregation types (SUM, COUNT, AVERAGE, MIN, MAX, MEDIAN, STDEV, PRODUCT, COUNT_DISTINCT), display mode transforms (% of row/col/grand total, rank, running total), sort by label/value, Top N / threshold filtering

## File Structure

```
modules/app-sheets/
  index.ts                      — Public API: schemas, types
  contract.ts                   — Zod schemas for cell format, sheet meta
  internal/
    spreadsheet-editor.ts       — Entry point: Hocuspocus setup, grid init
    grid-render.ts              — Grid rendering with column labels
    format/
      types.ts                  — CellFormat type, formatNumber, constants
      store.ts                  — Yjs-backed format storage
      renderer.ts               — Apply formatting to cell display
      toolbar.ts                — Format toolbar orchestrator
      toolbar-sections.ts       — Toolbar UI sections
      shortcuts.ts              — Keyboard shortcuts (Ctrl+B/I/U)
    sheet-store.ts              — Multi-sheet Yjs data model
    tab-bar.ts                  — Sheet tab bar UI
    tab-context-menu.ts         — Tab right-click menu
    range-selection.ts          — Cell range selection
    clipboard.ts                — Copy/paste with formatting
    col-row-ops.ts              — Insert/delete rows and columns
    col-row-resize.ts           — Column/row resize handles
    header-context-menu.ts      — Column/row header context menu
    sort-engine.ts              — Column sorting
    filter-manager.ts           — Filter orchestrator
    filter-bar.ts               — Filter bar UI
    filter-dropdown.ts          — Filter dropdown UI
    filter-state.ts             — Filter state management
    cell-evaluator.ts           — Cell formula evaluation
    cross-sheet-ref.ts          — Cross-sheet reference parser
    cond-format-rules.ts        — Conditional formatting rule storage
    cond-format-engine.ts       — Conditional formatting evaluation
    cond-format-renderer.ts     — Conditional formatting visual rendering
    cond-format-dialog.ts       — Conditional formatting rule editor
    presence.ts                 — Collaborative presence indicators
    pivot/
      pivot-aggregations.ts     — Aggregation functions (SUM, COUNT, MEDIAN, STDEV, etc.)
      pivot-engine.ts           — Pivot table computation with multi-value field support
      pivot-transforms.ts       — Display mode transforms (%, rank, running total)
      pivot-sort-filter.ts      — Sort by value/label, Top N / threshold filtering
      pivot-renderer.ts         — Pivot result → grid conversion, Yjs sheet writer
      pivot-field-list.ts       — Field selector UI components
      pivot-options.ts          — Advanced options UI (display mode, sort, filter)
      pivot-dialog.ts           — Pivot table dialog orchestrator
    css/
      spreadsheet.css           — Main spreadsheet styles
      sheets-selection.css      — Selection highlight styles
      sheets-col-row.css        — Column/row resize styles
      sheets-filter.css         — Filter UI styles
      sheets-cond-format.css    — Conditional formatting styles
      sheets-pivot.css          — Pivot table dialog and UI styles
```

## Verification

1. **Grid rendering** — Cells render with correct values and formatting.
2. **Multi-sheet tabs** — Create, rename, delete, switch sheets.
3. **Cell formatting** — Toolbar and shortcuts apply formatting via Yjs.
4. **Conditional formatting** — Rules apply visual styles correctly.
5. **Clipboard** — Copy/paste preserves formatting and values.
6. **Sorting/filtering** — Sort and filter operations work correctly.
7. **Build** — `npm run build` succeeds with updated entry points.
