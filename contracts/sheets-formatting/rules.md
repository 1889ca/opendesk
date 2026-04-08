# Contract: sheets-formatting

## Purpose

Provide cell formatting types, toolbar UI, format rendering, and keyboard shortcuts for the spreadsheet editor. Formatting data is stored in the Yjs shared document alongside cell values, enabling real-time collaborative formatting changes.

## Inputs

- User interactions: toolbar button clicks, keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
- Active cell coordinates: row and column of the currently selected cell
- Yjs shared document: the Y.Map-based cell data structure containing format metadata

## Outputs

- `CellFormat` type: bold, italic, underline, strikethrough, fontSize, textColor, backgroundColor, alignment, numberFormat, borders
- Formatting toolbar DOM element with buttons and selectors
- Inline styles applied to rendered grid cells based on their format
- Number display formatting (currency, percentage, date) while preserving raw values
- Yjs-synced format data that replicates to all collaborators

## Side Effects

- Reads and writes cell format data in the Yjs shared document
- Modifies DOM styles on spreadsheet grid cells
- Listens for keyboard events on the document for formatting shortcuts

## Invariants

1. **Format data syncs via Yjs.** All formatting changes are written to the Yjs shared document and replicate to collaborators automatically.
2. **Raw values are preserved.** Number formatting changes display only; the underlying numeric value is unchanged and available for formula calculations.
3. **Toolbar reflects active cell state.** When a cell gains focus, the toolbar buttons update to reflect that cell's current formatting.
4. **Keyboard shortcuts match conventions.** Ctrl+B = bold, Ctrl+I = italic, Ctrl+U = underline.
5. **Formats are optional.** A cell with no format data renders with default styles. Missing format fields default to their unset state.

## Dependencies

- `document/contract/spreadsheet.ts` (compile-time) -- CellFormat type definition
- `yjs` (runtime) -- Y.Map for per-cell format storage
- Spreadsheet editor module (runtime) -- grid rendering and cell selection

## Boundary Rules

### MUST

- Store format data in the Yjs shared document alongside cell values
- Apply formatting via inline styles on cell DOM elements
- Keep every file under 200 lines
- Use modern CSS only (no Tailwind, no preprocessors)
- Include contract header on every module file

### MUST NOT

- Mutate raw cell values when applying number formats
- Import server-side modules
- Use mock data
- Create files over 200 lines

## File Structure

```
modules/app/internal/
  sheets-format-types.ts       -- CellFormat type and number format utilities
  sheets-format-toolbar.ts     -- Toolbar DOM creation and event handling
  sheets-format-renderer.ts    -- Apply CellFormat to cell DOM elements
  sheets-format-store.ts       -- Yjs integration for reading/writing format data
  spreadsheet-editor.ts        -- Updated to integrate formatting modules
modules/app/internal/public/
  spreadsheet.css              -- Updated with formatting toolbar styles
```
