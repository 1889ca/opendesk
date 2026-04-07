# Contract: document

## Purpose

Define the canonical data types, schemas, and migration infrastructure that every other module depends on. The `document` module is a pure leaf — it exports types, Zod schemas, and migration functions. It has no runtime dependencies, no side effects, and no I/O.

## Inputs

This module has no runtime inputs. It is a type-and-schema library consumed at import time.

## Outputs

### DocumentSnapshot (discriminated union)

The single most load-bearing type in the system. Every module that touches document data operates on this type.

```typescript
type DocumentSnapshot = TextDocumentSnapshot;
// Phase 2+ adds members: SpreadsheetSnapshot, etc.
```

The discriminant field is `documentType`. All consumers MUST switch on `documentType` — never assume a specific variant.

### TextDocumentSnapshot

The only variant in Phase 1.

```typescript
type TextDocumentSnapshot = {
  documentType: 'text';
  schemaVersion: TextSchemaVersion;
  content: ProseMirrorJSON;
};
```

- `documentType`: literal `'text'`. This is the discriminant.
- `schemaVersion`: member of the `TextSchemaVersion` enum. Indicates which ProseMirror node/mark schema was used to produce `content`.
- `content`: ProseMirror-compatible JSON. Structure defined by TipTap's `getJSON()` output. Contains a `doc` root node with `content` array of block nodes. Each block node has a stable `attrs.blockId` (UUIDv4, assigned at creation, immutable for the block's lifetime).

### TextSchemaVersion

An enum of all known schema versions for text documents. Must be a string union, not a numeric enum.

```typescript
enum TextSchemaVersion {
  V1 = '1.0.0',
  // Future versions added here
}
```

The module MUST export `TextSchemaVersion.current` pointing to the latest version.

### Migration Registry

A registry of migration functions for upgrading snapshots between schema versions.

```typescript
type Migration = {
  from: TextSchemaVersion;
  to: TextSchemaVersion;
  up: (snapshot: TextDocumentSnapshot) => TextDocumentSnapshot;
};
```

Rules:
- Migrations are pure functions. No I/O, no side effects.
- Migrations MUST be sequential: `V1 -> V2 -> V3`. No skip-level migrations.
- The registry MUST be exhaustive: for every pair of adjacent versions, a migration MUST exist.
- Migrations run during materialization. The `collab` module calls `migrateToLatest(snapshot)` when reading from storage. Readers always receive `SchemaVersion.current`.
- `migrateToLatest` MUST be idempotent: calling it on a snapshot already at `current` returns the snapshot unchanged.

### revisionId

A single opaque string derived from the hash of the Yjs state vector. This is the sole concurrency clock for OCC (optimistic concurrency control).

```typescript
type RevisionId = string; // SHA-256 hex of serialized Yjs state vector
```

Rules:
- There is NO separate snapshot counter. One clock, one truth (Decision #003 amendment).
- The `document` module exports the hashing function: `computeRevisionId(stateVector: Uint8Array): RevisionId`.
- `computeRevisionId` is a pure function. It MUST produce identical output for identical input.
- The hash algorithm is SHA-256. The input is the raw Yjs state vector bytes (not base64-encoded, not JSON-serialized).

### DocumentIntent

The semantic command interface for agent (and system) writes. Agents send intents, not CRDT operations.

```typescript
type DocumentIntent = {
  idempotencyKey: string;       // UUIDv4, unique per intent submission
  baseRevision: RevisionId;     // the revisionId the actor read before deciding
  actorId: string;              // principal identifier
  actorType: 'human' | 'agent' | 'system';
  documentId: string;           // target document
  action: IntentAction;
};
```

#### IntentAction variants

```typescript
type IntentAction =
  | InsertBlockIntent
  | UpdateBlockIntent
  | DeleteBlockIntent
  | UpdateMarksIntent;

type InsertBlockIntent = {
  type: 'insert_block';
  afterBlockId: string | null;  // null = insert at document start
  blockType: string;            // e.g. 'paragraph', 'heading', 'codeBlock'
  content: string;              // plain text content for the new block
  attrs?: Record<string, unknown>; // optional block attributes (e.g. heading level)
};

type UpdateBlockIntent = {
  type: 'update_block';
  blockId: string;              // stable block ID (UUIDv4)
  content: string;              // replacement plain text content
};

type DeleteBlockIntent = {
  type: 'delete_block';
  blockId: string;              // stable block ID (UUIDv4)
};

type UpdateMarksIntent = {
  type: 'update_marks';
  blockId: string;              // stable block ID (UUIDv4)
  range: { start: number; end: number }; // character offsets within the block's text
  marks: MarkSpec[];            // marks to apply (e.g. [{ type: 'bold' }])
  action: 'add' | 'remove';    // whether to add or remove the specified marks
};

type MarkSpec = {
  type: string;                 // mark type name (e.g. 'bold', 'italic', 'link')
  attrs?: Record<string, unknown>; // mark attributes (e.g. { href: '...' } for links)
};
```

#### Intent targeting rules

- All block references use **stable block IDs** (UUIDv4 assigned at block creation). NEVER positional indices. NEVER JSON paths. (Decision #003: "IntentExecutor cannot use JSON paths for CRDT targeting.")
- `UpdateMarksIntent.range` uses character offsets within the targeted block's text content, not document-global offsets. These offsets are valid relative to the `baseRevision` state.
- If the targeted `blockId` does not exist at apply time, the intent MUST be rejected (not silently dropped).
- If `baseRevision` does not match the current `revisionId`, the `collab` module's IntentExecutor returns 409 Conflict. This is OCC — the agent must re-read and resubmit.

### ProseMirrorJSON

The JSON shape produced by TipTap's `getJSON()`. The `document` module exports a Zod schema for validation.

```typescript
type ProseMirrorJSON = {
  type: 'doc';
  content: ProseMirrorNode[];
};

type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};
```

The `attrs.blockId` field on top-level content nodes (direct children of `doc`) is REQUIRED and MUST be a valid UUIDv4. Nested nodes (inline content, marks) do not have block IDs.

## Side Effects

None. This module is pure data definitions: types, Zod schemas, and pure functions. No I/O, no network, no database, no filesystem.

## Invariants

1. **DocumentSnapshot is always valid against its schema version.** Any `TextDocumentSnapshot` with `schemaVersion: V` MUST pass `TextDocumentSnapshotSchema(V).parse()` without error.

2. **Block IDs are globally unique and immutable.** Once a `blockId` is assigned to a block node, it never changes for the lifetime of that block. Block IDs are UUIDv4.

3. **Schema versions are totally ordered.** For any two versions A and B, either A < B, A > B, or A === B. There are no forks or branches in the version lineage.

4. **Migration chain is complete.** For every adjacent version pair (V_n, V_{n+1}), a registered migration exists. `migrateToLatest` can reach `current` from any prior version by chaining.

5. **Migrations are pure and deterministic.** `up(snapshot)` always produces the same output for the same input. No randomness, no timestamps, no external state.

6. **revisionId is deterministic.** `computeRevisionId(stateVector)` always returns the same string for the same byte sequence.

7. **Every DocumentIntent has a unique idempotencyKey.** Duplicate keys (same UUIDv4 submitted twice) are detected and rejected by the collab module. The document module's schema enforces UUIDv4 format.

8. **IntentAction references are block-ID-based.** No intent schema accepts positional indices, array offsets, or JSON paths as targeting mechanisms.

9. **The discriminated union is exhaustive.** Any code that switches on `documentType` MUST handle all members. TypeScript's exhaustiveness checking (via `never` default) is mandatory for all consumers.

## Dependencies

None. This is a leaf module. It imports only:
- `zod` (runtime schema validation)
- Node.js `crypto` module (for SHA-256 in `computeRevisionId`)

No other OpenDesk module may be imported by `document`.

## Boundary Rules

### MUST

- Export all types via `contract.ts` (or `contract/` directory if >200 lines) using Zod schemas with inferred TypeScript types.
- Export `DocumentSnapshotSchema`, `DocumentIntentSchema`, `TextDocumentSnapshotSchema`, and all sub-schemas as named Zod exports.
- Use `z.discriminatedUnion('documentType', [...])` for the `DocumentSnapshot` schema so runtime validation produces clear error messages on unknown document types.
- Export `migrateToLatest(snapshot: DocumentSnapshot): DocumentSnapshot` as the public migration API.
- Export `computeRevisionId(stateVector: Uint8Array): RevisionId` as the public hashing API.
- Export `TextSchemaVersion.current` pointing to the latest version.
- Use `z.literal()` for the `documentType` discriminant in each variant schema.
- Validate `idempotencyKey` as UUIDv4 format in the Zod schema.
- Validate `blockId` fields as UUIDv4 format in the Zod schema.
- Validate `range.start < range.end` and both `>= 0` in the `UpdateMarksIntent` schema.
- Keep `contract.ts` (or each file in `contract/`) under 200 lines.

### MUST NOT

- Import any other OpenDesk module.
- Perform I/O of any kind (network, disk, database).
- Export mutable state. All exports are types, schemas, enums, and pure functions.
- Use numeric enums for schema versions (use string semver literals).
- Include CRDT-specific types (Yjs `Y.Doc`, `Y.XmlFragment`, etc.). The `document` module speaks ProseMirror JSON, not Yjs internals. The `collab` module bridges the gap.
- Define transport concerns (HTTP status codes, WebSocket frames, SSE event shapes). Those belong to `api`.
- Use `any` or `unknown` in exported type positions. All types must be fully specified.
- Skip Zod validation and export raw TypeScript types. Every exported type MUST have a corresponding Zod schema.
- Accept or produce mock data in any export, test fixture, or example.

## Verification

How to test each invariant:

1. **Snapshot schema validity** -- Property-based test: generate random valid `TextDocumentSnapshot` values, verify they pass `TextDocumentSnapshotSchema.parse()`. Generate invalid values (missing fields, wrong types, missing blockIds), verify they fail.

2. **Block ID uniqueness and format** -- Unit test: verify the Zod schema rejects non-UUIDv4 strings in `blockId` and `afterBlockId` fields. Property test: generate snapshots and assert all `blockId` values within a document are distinct.

3. **Schema version total ordering** -- Unit test: enumerate all `TextSchemaVersion` members, verify they parse as valid semver, and verify `semver.compare` produces a consistent total order.

4. **Migration chain completeness** -- Unit test: for every adjacent pair in the version enum, assert a migration is registered. Call `migrateToLatest` from `V1` through to `current` on a fixture snapshot and verify the output passes the `current` schema.

5. **Migration purity** -- Property-based test: call `up(snapshot)` twice with the same input, assert outputs are deeply equal. Call `migrateToLatest` on an already-current snapshot, assert output equals input.

6. **revisionId determinism** -- Property-based test: generate random `Uint8Array` values, call `computeRevisionId` twice on each, assert identical output. Verify output is a valid lowercase hex string of length 64 (SHA-256).

7. **Idempotency key format** -- Unit test: verify the `DocumentIntentSchema` rejects non-UUIDv4 `idempotencyKey` values. Verify it accepts valid UUIDv4 strings.

8. **Block-ID-based targeting** -- Schema test: verify no intent variant schema accepts fields named `index`, `path`, `position`, or `offset` (except `range.start`/`range.end` within `UpdateMarksIntent`, which are intra-block character offsets, not document positions).

9. **Discriminated union exhaustiveness** -- Compile-time test: write a switch on `documentType` without a case for each member and verify TypeScript emits an error when a `default: assertNever(x)` pattern is used.

## File Structure

```
modules/document/
  contract.ts          -- Zod schemas, inferred types, enums, pure functions (or contract/ directory)
  index.ts             -- re-exports public API from contract.ts
  internal/
    migrations.ts      -- migration registry and migrateToLatest implementation
    revision.ts        -- computeRevisionId implementation
```

## Phase 2 Extension Point

When adding a new document type (e.g. `SpreadsheetSnapshot`):

1. Define `SpreadsheetSnapshot` type with `documentType: 'spreadsheet'`.
2. Add it to the `DocumentSnapshot` union: `type DocumentSnapshot = TextDocumentSnapshot | SpreadsheetSnapshot`.
3. Add its Zod schema as a new member of `z.discriminatedUnion('documentType', [...])`.
4. Add a corresponding `SpreadsheetSchemaVersion` enum and migration registry.
5. Extend `IntentAction` with spreadsheet-specific actions if needed.
6. All existing consumers that switch on `documentType` will get compile errors until they handle the new variant. This is by design.

## MVP Scope

Implemented:
- [x] `DocumentSnapshot` discriminated union type (with `TextDocumentSnapshot` variant)
- [x] `TextSchemaVersion` enum with `current` export
- [x] `ProseMirrorJSON` type and Zod schema
- [x] `DocumentIntent` and `IntentAction` types with Zod schemas
- [x] `computeRevisionId` pure function (SHA-256 of state vector)
- [x] `migrateToLatest` idempotent migration function
- [x] Migration registry (sequential, pure, deterministic)
- [x] Leaf module with no runtime dependencies
- [x] Block-ID-based intent targeting (no JSON paths)
- [x] Zod schemas for all exported types
- [x] `contract.ts` under 200 lines

Post-MVP (deferred):
- [ ] Property-based tests for snapshot schema validity — unit tests exist, property-based tests planned
- [ ] Block ID uniqueness test (assert all blockIds in a document are distinct)
- [ ] Exhaustiveness compile-time test (`assertNever` pattern for `documentType` switch)
