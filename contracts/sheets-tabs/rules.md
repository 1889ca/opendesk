# Contract: sheets-tabs

## Purpose

Multi-sheet tab management for the OpenDesk spreadsheet editor. Provides the Yjs data model for multiple sheets, tab bar UI for switching/adding/renaming/deleting sheets, and cross-sheet formula references.

## Inputs

- Yjs document (`Y.Doc`) containing spreadsheet data
- User interactions: tab clicks, context menu actions, add-sheet button clicks
- Formula strings containing cross-sheet references (e.g., `Sheet2!A1`)

## Outputs

- Sheet data structures in Yjs (Y.Map for sheet registry, Y.Array of Y.Arrays per sheet)
- Tab bar DOM elements appended to the spreadsheet container
- Parsed cross-sheet cell references for the formula evaluator
- Events dispatched on sheet switch (`opendesk:sheet-switch`)

## Invariants

1. **Migration safety.** Existing documents with a bare `sheet-0` Y.Array are automatically migrated to the multi-sheet model on first load. The original data becomes "Sheet 1".
2. **Unique sheet IDs.** Every sheet has a unique string ID (e.g., `sheet-0`, `sheet-1`). IDs are never reused within a document.
3. **At least one sheet.** A document always has at least one sheet. Deleting the last sheet is prevented.
4. **Yjs-transacted mutations.** All sheet creation, deletion, renaming, and reordering operations occur inside `ydoc.transact()`.
5. **Cross-sheet references.** Formula references using `SheetName!CellRef` syntax resolve against the named sheet's data. Invalid sheet names produce `#REF!` errors.

## Dependencies

- `yjs` (runtime) - CRDT document model
- `app` module (compile-time) - spreadsheet editor integration

## File Structure

```
modules/app/internal/sheets/
  sheet-store.ts        -- Yjs data model for multi-sheet management
  tab-bar.ts            -- Tab bar UI component
  tab-context-menu.ts   -- Right-click context menu for tabs
  cross-sheet-ref.ts    -- Cross-sheet reference parser
```
