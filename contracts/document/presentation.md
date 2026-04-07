# Contract: presentation

## Purpose

Define the canonical data types, schemas, and migration infrastructure for the presentation document type. This is a leaf module that extends the `document` module's `DocumentSnapshot` discriminated union with a `PresentationSnapshot` variant. It exports types, Zod schemas, and migration functions. It has no runtime dependencies, no side effects, and no I/O.

## Inputs

This module has no runtime inputs. It is a type-and-schema library consumed at import time.

## Outputs

### PresentationSnapshot

A new member of the `DocumentSnapshot` discriminated union.

```typescript
type PresentationSnapshot = {
  documentType: 'presentation';
  schemaVersion: PresentationSchemaVersion;
  content: PresentationContent;
};
```

- `documentType`: literal `'presentation'`. This is the discriminant.
- `schemaVersion`: member of the `PresentationSchemaVersion` enum. Indicates which slide schema was used to produce `content`.
- `content`: the slide deck model described below.

### PresentationContent

The slide deck data model for a presentation.

```typescript
type PresentationContent = {
  slides: Slide[];
};

type Slide = {
  elements: SlideElement[];
};

type SlideElement = {
  elementId: string;           // UUIDv4, stable identifier for this element
  type: ElementType;
  position: Position;
  size: Size;
  content: ElementContent;
  rotation?: number;           // degrees, default 0
  opacity?: number;            // 0.0 to 1.0, default 1.0
};

type ElementType = 'text' | 'image' | 'shape' | 'table' | 'chart' | 'video';

type Position = {
  x: number;                   // horizontal offset in points from slide left edge
  y: number;                   // vertical offset in points from slide top edge
};

type Size = {
  width: number;               // width in points
  height: number;              // height in points
};

type ElementContent =
  | TextContent
  | ImageContent
  | ShapeContent
  | TableContent
  | ChartContent
  | VideoContent;

type TextContent = {
  type: 'text';
  text: string;                // plain text content
  fontSize?: number;           // in points
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;          // CSS hex color
  alignment?: 'left' | 'center' | 'right';
};

type ImageContent = {
  type: 'image';
  src: string;                 // storage key or URL
  alt?: string;                // alt text for accessibility
};

type ShapeContent = {
  type: 'shape';
  shapeType: 'rectangle' | 'ellipse' | 'triangle' | 'arrow' | 'line';
  fill?: string;               // CSS hex color
  stroke?: string;             // CSS hex color
  strokeWidth?: number;        // in points
};

type TableContent = {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][];           // rows x cols grid of cell text values
};

type ChartContent = {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  data: ChartData;
};

type ChartData = {
  labels: string[];
  series: ChartSeries[];
};

type ChartSeries = {
  name: string;
  values: number[];
};

type VideoContent = {
  type: 'video';
  src: string;                 // storage key or URL
  poster?: string;             // thumbnail storage key or URL
};
```

Rules:
- `slides` MUST contain at least one `Slide`.
- `SlideElement.elementId` MUST be a valid UUIDv4, unique within the entire presentation.
- `SlideElement.type` MUST match `ElementContent.type` (discriminated by content type field).
- `Size.width` and `Size.height` MUST be positive numbers.
- `TableContent.cells` dimensions MUST match `TableContent.rows` x `TableContent.cols`.

### PresentationSchemaVersion

An enum of all known schema versions for presentation documents.

```typescript
enum PresentationSchemaVersion {
  V1 = '1.0.0',
  // Future versions added here
}
```

The module MUST export `PresentationSchemaVersion.current` pointing to the latest version.

### Migration Registry

A registry of migration functions for upgrading presentation snapshots between schema versions.

```typescript
type PresentationMigration = {
  from: PresentationSchemaVersion;
  to: PresentationSchemaVersion;
  up: (snapshot: PresentationSnapshot) => PresentationSnapshot;
};
```

Rules:
- Migrations are pure functions. No I/O, no side effects.
- Migrations MUST be sequential: `V1 -> V2 -> V3`. No skip-level migrations.
- The registry MUST be exhaustive: for every pair of adjacent versions, a migration MUST exist.
- Migrations run during materialization. The `collab` module calls `migrateToLatest(snapshot)` when reading from storage.
- `migrateToLatest` MUST be idempotent: calling it on a snapshot already at `current` returns the snapshot unchanged.

### PresentationIntent

The semantic command interface for agent (and system) writes to presentation documents.

```typescript
type PresentationIntent = {
  idempotencyKey: string;       // UUIDv4, unique per intent submission
  baseRevision: RevisionId;     // the revisionId the actor read before deciding
  actorId: string;              // principal identifier
  actorType: 'human' | 'agent' | 'system';
  documentId: string;           // target document
  action: PresentationIntentAction;
};
```

#### PresentationIntentAction variants

```typescript
type PresentationIntentAction =
  | InsertSlideIntent
  | DeleteSlideIntent
  | ReorderSlidesIntent
  | UpdateElementIntent
  | InsertElementIntent
  | DeleteElementIntent;

type InsertSlideIntent = {
  type: 'insert_slide';
  afterSlideIndex: number | null; // zero-based; null = insert at position 0
};

type DeleteSlideIntent = {
  type: 'delete_slide';
  slideIndex: number;             // zero-based index of the slide to delete
};

type ReorderSlidesIntent = {
  type: 'reorder_slides';
  order: number[];                // new ordering as array of current slide indices
};

type UpdateElementIntent = {
  type: 'update_element';
  slideIndex: number;             // zero-based index of the target slide
  elementId: string;              // UUIDv4 of the element to update
  position?: Position;            // new position (omit to leave unchanged)
  size?: Size;                    // new size (omit to leave unchanged)
  content?: ElementContent;       // new content (omit to leave unchanged)
  rotation?: number;              // new rotation (omit to leave unchanged)
  opacity?: number;               // new opacity (omit to leave unchanged)
};

type InsertElementIntent = {
  type: 'insert_element';
  slideIndex: number;             // zero-based index of the target slide
  element: SlideElement;          // the full element to insert (must include elementId)
};

type DeleteElementIntent = {
  type: 'delete_element';
  slideIndex: number;             // zero-based index of the target slide
  elementId: string;              // UUIDv4 of the element to delete
};
```

#### Intent targeting rules

- Slides are targeted by **slideIndex** (zero-based integer).
- Elements are targeted by **slideIndex + elementId** (UUIDv4). This provides stable identity across reorders and concurrent edits.
- `slideIndex` MUST be a non-negative integer less than the number of slides.
- `elementId` MUST be a valid UUIDv4.
- If the target slide or element does not exist at apply time, the intent MUST be rejected (not silently dropped).
- If `baseRevision` does not match the current `revisionId`, the `collab` module's IntentExecutor returns 409 Conflict. This is OCC -- the agent must re-read and resubmit.
- `DeleteSlideIntent` MUST be rejected if it would leave the presentation with zero slides.
- `ReorderSlidesIntent.order` MUST be a permutation of `[0, 1, ..., slides.length - 1]`. Any other value is rejected.

## Side Effects

None. This module is pure data definitions: types, Zod schemas, and pure functions. No I/O, no network, no database, no filesystem.

## Invariants

1. **PresentationSnapshot is always valid against its schema version.** Any `PresentationSnapshot` with `schemaVersion: V` MUST pass `PresentationSnapshotSchema(V).parse()` without error.

2. **Element IDs are globally unique within a presentation.** No two elements across all slides may share an `elementId`.

3. **Element type matches content type.** `SlideElement.type` MUST equal `SlideElement.content.type` for every element.

4. **At least one slide exists.** A `PresentationSnapshot` MUST always contain at least one slide in `content.slides`.

5. **Schema versions are totally ordered.** For any two versions A and B, either A < B, A > B, or A === B. There are no forks or branches in the version lineage.

6. **Migration chain is complete.** For every adjacent version pair (V_n, V_{n+1}), a registered migration exists. `migrateToLatest` can reach `current` from any prior version by chaining.

7. **Migrations are pure and deterministic.** `up(snapshot)` always produces the same output for the same input. No randomness, no timestamps, no external state.

8. **Every PresentationIntent has a unique idempotencyKey.** Duplicate keys (same UUIDv4 submitted twice) are detected and rejected by the collab module.

9. **IntentAction references use slideIndex + elementId.** No intent schema accepts JSON paths, positional element indices, or opaque handles as targeting mechanisms. Slides are indexed; elements are identified by stable UUIDv4.

10. **The discriminated union is exhaustive.** Any code that switches on `documentType` MUST handle the `'presentation'` variant. TypeScript's exhaustiveness checking (via `never` default) is mandatory.

## Dependencies

None. This is a leaf module. It imports only:
- `zod` (runtime schema validation)
- Types from `document` module (`RevisionId` type, shared intent envelope fields)

No other OpenDesk module may be imported by `presentation`.

## Boundary Rules

### MUST

- Export all types via `contract.ts` (or `contract/` directory if >200 lines) using Zod schemas with inferred TypeScript types.
- Export `PresentationSnapshotSchema`, `PresentationIntentSchema`, and all sub-schemas as named Zod exports.
- Use `z.literal('presentation')` for the `documentType` discriminant in the snapshot schema.
- Export `migrateToLatest(snapshot: PresentationSnapshot): PresentationSnapshot` as the public migration API.
- Export `PresentationSchemaVersion.current` pointing to the latest version.
- Validate `idempotencyKey` as UUIDv4 format in the Zod schema.
- Validate `elementId` as UUIDv4 format in the Zod schema.
- Validate `slideIndex` as non-negative integer in the Zod schema.
- Validate `Size.width` and `Size.height` as positive numbers.
- Validate `content.slides` has `min(1)`.
- Validate `ReorderSlidesIntent.order` is a valid permutation via Zod `.refine()`.
- Validate element ID uniqueness across all slides via Zod `.refine()`.
- Validate `SlideElement.type` matches `SlideElement.content.type` via Zod `.refine()`.
- Keep `contract.ts` (or each file in `contract/`) under 200 lines.

### MUST NOT

- Import any OpenDesk module other than `document` (for shared types only).
- Perform I/O of any kind (network, disk, database).
- Export mutable state. All exports are types, schemas, enums, and pure functions.
- Use numeric enums for schema versions (use string semver literals).
- Include CRDT-specific types (Yjs `Y.Doc`, `Y.XmlFragment`, etc.). The `presentation` module speaks slide JSON, not Yjs internals.
- Define transport concerns (HTTP status codes, WebSocket frames, SSE event shapes). Those belong to `api`.
- Use `any` or `unknown` in exported type positions. All types must be fully specified.
- Skip Zod validation and export raw TypeScript types. Every exported type MUST have a corresponding Zod schema.
- Accept or produce mock data in any export, test fixture, or example.
- Use positional element indices for element targeting. Elements are always addressed by `elementId` (UUIDv4).

## Verification

How to test each invariant:

1. **Snapshot schema validity** -- Property-based test: generate random valid `PresentationSnapshot` values, verify they pass `PresentationSnapshotSchema.parse()`. Generate invalid values (missing fields, wrong types, size <= 0), verify they fail.

2. **Element ID uniqueness** -- Property-based test: generate snapshots and assert all `elementId` values across all slides are distinct. Unit test: create a snapshot with duplicate element IDs across slides, verify the Zod schema rejects it.

3. **Element type/content type consistency** -- Unit test: create elements where `type` does not match `content.type`, verify the Zod schema rejects them.

4. **Minimum one slide** -- Unit test: create a snapshot with empty `slides` array, verify the Zod schema rejects it.

5. **Schema version total ordering** -- Unit test: enumerate all `PresentationSchemaVersion` members, verify they parse as valid semver, and verify `semver.compare` produces a consistent total order.

6. **Migration chain completeness** -- Unit test: for every adjacent pair in the version enum, assert a migration is registered. Call `migrateToLatest` from `V1` through to `current` on a fixture snapshot and verify the output passes the `current` schema.

7. **Migration purity** -- Property-based test: call `up(snapshot)` twice with the same input, assert outputs are deeply equal. Call `migrateToLatest` on an already-current snapshot, assert output equals input.

8. **Idempotency key format** -- Unit test: verify the `PresentationIntentSchema` rejects non-UUIDv4 `idempotencyKey` values.

9. **Targeting mechanism** -- Schema test: verify element-targeting intents require `elementId` (UUIDv4) and `slideIndex`, never positional element indices or JSON paths.

10. **Discriminated union exhaustiveness** -- Compile-time test: write a switch on `documentType` including `'presentation'` and verify TypeScript requires handling it when using `default: assertNever(x)`.

## File Structure

```
modules/presentation/
  contract.ts          -- Zod schemas, inferred types, enums, pure functions (or contract/ directory)
  index.ts             -- re-exports public API from contract.ts
  internal/
    migrations.ts      -- migration registry and migrateToLatest implementation
```

## Integration with document module

When this module is added:

1. `DocumentSnapshot` union becomes: `type DocumentSnapshot = TextDocumentSnapshot | SpreadsheetSnapshot | PresentationSnapshot`.
2. `z.discriminatedUnion('documentType', [...])` in the document module gains the `PresentationSnapshotSchema` member.
3. `IntentAction` union in the document module is extended with `PresentationIntentAction` variants.
4. All existing consumers that switch on `documentType` will get compile errors until they handle `'presentation'`. This is by design.
