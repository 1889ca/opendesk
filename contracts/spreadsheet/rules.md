# Contract: spreadsheet

## Purpose

Define the canonical data types, schemas, and migration infrastructure for the spreadsheet document type. This is a leaf module that extends the `document` module's `DocumentSnapshot` discriminated union with a `SpreadsheetSnapshot` variant. It exports types, Zod schemas, and migration functions. It has no runtime dependencies, no side effects, and no I/O.

## Inputs

This module has no runtime inputs. It is a type-and-schema library consumed at import time.

## Outputs

### SpreadsheetSnapshot

A new member of the `DocumentSnapshot` discriminated union.

```typescript
type SpreadsheetSnapshot = {
  documentType: 'spreadsheet';
  schemaVersion: SpreadsheetSchemaVersion;
  content: SpreadsheetContent;
};
```

- `documentType`: literal `'spreadsheet'`. This is the discriminant.
- `schemaVersion`: member of the `SpreadsheetSchemaVersion` enum. Indicates which grid schema was used to produce `content`.
- `content`: the grid model described below.

### SpreadsheetContent

The grid data model for a spreadsheet.

```typescript
type SpreadsheetContent = {
  sheets: Sheet[];
};

type Sheet = {
  name: string;               // human-readable sheet name (e.g. "Sheet1")
  columnCount: number;         // number of columns in the sheet
  rows: Row[];
};

type Row = {
  cells: Cell[];
};

type Cell = {
  value: CellValue;
  formula?: string;            // e.g. "=SUM(A1:A10)", absent if no formula
  format?: CellFormat;         // optional display formatting
};

type CellValue = string | number | boolean | null;

type CellFormat = {
  numberFormat?: string;       // e.g. "#,##0.00", "0%", "yyyy-mm-dd"
  bold?: boolean;
  italic?: boolean;
  textColor?: string;          // CSS hex color, e.g. "#ff0000"
  backgroundColor?: string;   // CSS hex color
  alignment?: 'left' | 'center' | 'right';
};
```

Rules:
- `sheets` MUST contain at least one `Sheet`.
- `Sheet.name` MUST be a non-empty string, unique within the spreadsheet.
- `Sheet.columnCount` MUST be a positive integer. Every `Row.cells` array length MUST equal the parent `Sheet.columnCount`.
- `Cell.value` is the computed/display value. If `Cell.formula` is present, `value` holds the last computed result.

### SpreadsheetSchemaVersion

An enum of all known schema versions for spreadsheet documents.

```typescript
enum SpreadsheetSchemaVersion {
  V1 = '1.0.0',
  // Future versions added here
}
```

The module MUST export `SpreadsheetSchemaVersion.current` pointing to the latest version.

### Migration Registry

A registry of migration functions for upgrading spreadsheet snapshots between schema versions.

```typescript
type SpreadsheetMigration = {
  from: SpreadsheetSchemaVersion;
  to: SpreadsheetSchemaVersion;
  up: (snapshot: SpreadsheetSnapshot) => SpreadsheetSnapshot;
};
```

Rules:
- Migrations are pure functions. No I/O, no side effects.
- Migrations MUST be sequential: `V1 -> V2 -> V3`. No skip-level migrations.
- The registry MUST be exhaustive: for every pair of adjacent versions, a migration MUST exist.
- Migrations run during materialization. The `collab` module calls `migrateToLatest(snapshot)` when reading from storage.
- `migrateToLatest` MUST be idempotent: calling it on a snapshot already at `current` returns the snapshot unchanged.

### SpreadsheetIntent

The semantic command interface for agent (and system) writes to spreadsheet documents.

```typescript
type SpreadsheetIntent = {
  idempotencyKey: string;       // UUIDv4, unique per intent submission
  baseRevision: RevisionId;     // the revisionId the actor read before deciding
  actorId: string;              // principal identifier
  actorType: 'human' | 'agent' | 'system';
  documentId: string;           // target document
  action: SpreadsheetIntentAction;
};
```

#### SpreadsheetIntentAction variants

```typescript
type SpreadsheetIntentAction =
  | InsertRowIntent
  | DeleteRowIntent
  | InsertColumnIntent
  | DeleteColumnIntent
  | UpdateCellIntent
  | RenameSheetIntent
  | InsertSheetIntent
  | DeleteSheetIntent;

type InsertRowIntent = {
  type: 'insert_row';
  sheetIndex: number;          // zero-based index of the target sheet
  afterRow: number | null;     // zero-based row index to insert after; null = insert at row 0
  count?: number;              // number of rows to insert (default 1)
};

type DeleteRowIntent = {
  type: 'delete_row';
  sheetIndex: number;
  row: number;                 // zero-based row index to delete
  count?: number;              // number of rows to delete starting at row (default 1)
};

type InsertColumnIntent = {
  type: 'insert_column';
  sheetIndex: number;
  afterCol: number | null;     // zero-based column index to insert after; null = insert at col 0
  count?: number;              // number of columns to insert (default 1)
};

type DeleteColumnIntent = {
  type: 'delete_column';
  sheetIndex: number;
  col: number;                 // zero-based column index to delete
  count?: number;              // number of columns to delete starting at col (default 1)
};

type UpdateCellIntent = {
  type: 'update_cell';
  sheetIndex: number;
  row: number;                 // zero-based row index
  col: number;                 // zero-based column index
  value?: CellValue;           // new computed value (omit to leave unchanged)
  formula?: string | null;     // new formula (null to clear, omit to leave unchanged)
  format?: CellFormat | null;  // new format (null to clear, omit to leave unchanged)
};

type RenameSheetIntent = {
  type: 'rename_sheet';
  sheetIndex: number;
  name: string;                // new sheet name (must be non-empty, unique within document)
};

type InsertSheetIntent = {
  type: 'insert_sheet';
  afterSheetIndex: number | null; // null = insert at position 0
  name: string;                   // name for the new sheet
  columnCount?: number;           // default column count (default 26)
  rowCount?: number;              // default row count (default 100)
};

type DeleteSheetIntent = {
  type: 'delete_sheet';
  sheetIndex: number;
};
```

#### Intent targeting rules

- All cell references use **sheetIndex + row + col** (zero-based integers). This is the canonical addressing for spreadsheet content.
- `sheetIndex` MUST be a non-negative integer less than the number of sheets.
- `row` and `col` MUST be non-negative integers within the bounds of the target sheet's dimensions.
- If the target cell, row, column, or sheet does not exist at apply time, the intent MUST be rejected (not silently dropped).
- If `baseRevision` does not match the current `revisionId`, the `collab` module's IntentExecutor returns 409 Conflict. This is OCC -- the agent must re-read and resubmit.
- `DeleteSheetIntent` MUST be rejected if it would leave the spreadsheet with zero sheets.

## Side Effects

None. This module is pure data definitions: types, Zod schemas, and pure functions. No I/O, no network, no database, no filesystem.

## Invariants

1. **SpreadsheetSnapshot is always valid against its schema version.** Any `SpreadsheetSnapshot` with `schemaVersion: V` MUST pass `SpreadsheetSnapshotSchema(V).parse()` without error.

2. **Sheet names are unique.** No two sheets within the same spreadsheet may share a name.

3. **Row width matches columnCount.** Every `Row.cells` array within a `Sheet` MUST have length equal to `Sheet.columnCount`.

4. **At least one sheet exists.** A `SpreadsheetSnapshot` MUST always contain at least one sheet in `content.sheets`.

5. **Schema versions are totally ordered.** For any two versions A and B, either A < B, A > B, or A === B. There are no forks or branches in the version lineage.

6. **Migration chain is complete.** For every adjacent version pair (V_n, V_{n+1}), a registered migration exists. `migrateToLatest` can reach `current` from any prior version by chaining.

7. **Migrations are pure and deterministic.** `up(snapshot)` always produces the same output for the same input. No randomness, no timestamps, no external state.

8. **Every SpreadsheetIntent has a unique idempotencyKey.** Duplicate keys (same UUIDv4 submitted twice) are detected and rejected by the collab module.

9. **IntentAction references are coordinate-based.** All targeting uses `sheetIndex`, `row`, `col` -- never cell names like "A1", never JSON paths, never opaque IDs.

10. **The discriminated union is exhaustive.** Any code that switches on `documentType` MUST handle the `'spreadsheet'` variant. TypeScript's exhaustiveness checking (via `never` default) is mandatory.

## Dependencies

None. This is a leaf module. It imports only:
- `zod` (runtime schema validation)
- Types from `document` module (`RevisionId` type, shared intent envelope fields)

No other OpenDesk module may be imported by `spreadsheet`.

## Boundary Rules

### MUST

- Export all types via `contract.ts` (or `contract/` directory if >200 lines) using Zod schemas with inferred TypeScript types.
- Export `SpreadsheetSnapshotSchema`, `SpreadsheetIntentSchema`, and all sub-schemas as named Zod exports.
- Use `z.literal('spreadsheet')` for the `documentType` discriminant in the snapshot schema.
- Export `migrateToLatest(snapshot: SpreadsheetSnapshot): SpreadsheetSnapshot` as the public migration API.
- Export `SpreadsheetSchemaVersion.current` pointing to the latest version.
- Validate `idempotencyKey` as UUIDv4 format in the Zod schema.
- Validate `sheetIndex`, `row`, and `col` as non-negative integers in the Zod schema.
- Validate `Sheet.name` as non-empty string.
- Validate `Sheet.columnCount` as positive integer.
- Validate `content.sheets` has `min(1)`.
- Validate row cell array lengths match `columnCount` via Zod `.refine()`.
- Keep `contract.ts` (or each file in `contract/`) under 200 lines.

### MUST NOT

- Import any OpenDesk module other than `document` (for shared types only).
- Perform I/O of any kind (network, disk, database).
- Export mutable state. All exports are types, schemas, enums, and pure functions.
- Use numeric enums for schema versions (use string semver literals).
- Include CRDT-specific types (Yjs `Y.Doc`, `Y.Array`, etc.). The `spreadsheet` module speaks grid JSON, not Yjs internals.
- Define transport concerns (HTTP status codes, WebSocket frames, SSE event shapes). Those belong to `api`.
- Use `any` or `unknown` in exported type positions. All types must be fully specified.
- Skip Zod validation and export raw TypeScript types. Every exported type MUST have a corresponding Zod schema.
- Accept or produce mock data in any export, test fixture, or example.
- Use string cell references like "A1" or "B2:C5" in intent actions. All addressing is numeric coordinates.

## Verification

How to test each invariant:

1. **Snapshot schema validity** -- Property-based test: generate random valid `SpreadsheetSnapshot` values, verify they pass `SpreadsheetSnapshotSchema.parse()`. Generate invalid values (missing fields, wrong types, mismatched cell counts), verify they fail.

2. **Sheet name uniqueness** -- Unit test: create a snapshot with duplicate sheet names, verify the Zod schema rejects it. Property test: generate snapshots and assert all sheet names within a document are distinct.

3. **Row width consistency** -- Property-based test: generate snapshots where some rows have incorrect cell counts, verify schema rejects them. Generate valid snapshots, verify all rows match their sheet's `columnCount`.

4. **Minimum one sheet** -- Unit test: create a snapshot with empty `sheets` array, verify the Zod schema rejects it.

5. **Schema version total ordering** -- Unit test: enumerate all `SpreadsheetSchemaVersion` members, verify they parse as valid semver, and verify `semver.compare` produces a consistent total order.

6. **Migration chain completeness** -- Unit test: for every adjacent pair in the version enum, assert a migration is registered. Call `migrateToLatest` from `V1` through to `current` on a fixture snapshot and verify the output passes the `current` schema.

7. **Migration purity** -- Property-based test: call `up(snapshot)` twice with the same input, assert outputs are deeply equal. Call `migrateToLatest` on an already-current snapshot, assert output equals input.

8. **Idempotency key format** -- Unit test: verify the `SpreadsheetIntentSchema` rejects non-UUIDv4 `idempotencyKey` values.

9. **Coordinate-based targeting** -- Schema test: verify no intent variant schema accepts fields named `cellRef`, `range`, `address`, or `path`. All targeting uses `sheetIndex`, `row`, `col`.

10. **Discriminated union exhaustiveness** -- Compile-time test: write a switch on `documentType` including `'spreadsheet'` and verify TypeScript requires handling it when using `default: assertNever(x)`.

## File Structure

```
modules/spreadsheet/
  contract.ts          -- Zod schemas, inferred types, enums, pure functions (or contract/ directory)
  index.ts             -- re-exports public API from contract.ts
  internal/
    migrations.ts      -- migration registry and migrateToLatest implementation
```

## Integration with document module

When this module is added:

1. `DocumentSnapshot` union becomes: `type DocumentSnapshot = TextDocumentSnapshot | SpreadsheetSnapshot`.
2. `z.discriminatedUnion('documentType', [...])` in the document module gains the `SpreadsheetSnapshotSchema` member.
3. `IntentAction` union in the document module is extended with `SpreadsheetIntentAction` variants.
4. All existing consumers that switch on `documentType` will get compile errors until they handle `'spreadsheet'`. This is by design.
