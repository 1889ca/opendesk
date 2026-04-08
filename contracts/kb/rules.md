# Contract: kb

## Purpose

Typed knowledge base providing multi-type entries (Reference, Entity, Dataset, Note) with first-class relationships (property graph lite), full-text search, reverse dependency lookups, and version pinning — all workspace-scoped via PostgreSQL.

## Inputs

- `workspaceId: string` — UUID scoping all queries and mutations
- `KBEntryInput` — entry creation/update payload with entryType, title, metadata, tags
- `KBRelationshipInput` — relationship creation payload with sourceId, targetId, relationType
- `KBQueryFilter` — optional filters: entryType, tags, search query, pagination

## Outputs

- `KBEntry` — full entry record with id, workspaceId, entryType, title, metadata, tags, version, timestamps
- `KBRelationship` — edge record with id, sourceId, targetId, relationType, metadata
- `KBSearchResult` — entry plus relevance rank and snippet
- `KBEntry[]` — reverse dependency list (all entries referencing a given entry)

## Side Effects

- PostgreSQL reads/writes via the shared pool from `storage` module
- Full-text search index maintenance (GIN index on title + metadata)

## Invariants

1. **Workspace isolation.** Every query and mutation is scoped to a workspaceId. No cross-workspace data leakage.
2. **Entry type validation.** Each entryType has a distinct metadata Zod schema. Metadata must validate against the schema for its type.
3. **Referential integrity for relationships.** sourceId and targetId must reference existing entries in the same workspace. Deleting an entry cascades to its relationships.
4. **Relationship uniqueness.** At most one relationship of a given relationType between the same (sourceId, targetId) pair in a workspace.
5. **Version monotonicity.** Entry version numbers are monotonically increasing. Updates increment the version and record a history entry.
6. **Tag normalization.** Tags are lowercase, trimmed, deduplicated.
7. **Parameterized SQL only.** No string interpolation in queries.

## Dependencies

- `storage` — shared PostgreSQL connection pool
- `zod` — runtime schema validation

## Boundary Rules

### MUST

- Export all types via `contract.ts` with Zod schemas and inferred TypeScript types.
- Use parameterized queries for all SQL.
- Scope every query to workspaceId.
- Validate all inputs with Zod before database operations.
- Support five entry types: reference, entity, dataset, note.
- Support relationship types: cites, authored-by, related-to, derived-from, supersedes, plus custom strings.
- Provide reverse dependency lookup (given entry ID, find all entries that reference it).
- Track version history for entries.
- Keep every file under 200 lines.

### MUST NOT

- Perform cross-workspace queries.
- Use string interpolation in SQL.
- Import auth, permissions, or sharing modules (access control is caller's responsibility).
- Export mutable state.
- Use mock data in any test or fixture.

## Verification

1. **Workspace isolation** — Create entries in two workspaces, verify queries never return cross-workspace data.
2. **Entry type metadata** — Validate that each entry type accepts its schema and rejects other types' metadata.
3. **Relationship integrity** — Create a relationship, delete the source entry, verify relationship is cascade-deleted.
4. **Relationship uniqueness** — Attempt duplicate relationship creation, verify rejection.
5. **Version tracking** — Update an entry multiple times, verify version increments and history is recorded.
6. **Tag normalization** — Create entry with mixed-case/duplicate tags, verify stored tags are normalized.
7. **Reverse dependencies** — Create entries with relationships, query reverse deps, verify completeness.
8. **Search** — Create entries with distinct titles, search by keyword, verify results and ranking.

## File Structure

```
modules/kb/
  contract.ts          -- Zod schemas, inferred types, enums
  index.ts             -- public API re-exports
  internal/
    types.ts           -- internal type helpers
    schemas.ts         -- Zod schemas for type-specific metadata
    entries-store.ts   -- PostgreSQL CRUD for entries
    relationships-store.ts -- PostgreSQL CRUD for relationships
    search.ts          -- full-text search implementation
    reverse-deps.ts    -- reverse dependency lookup
    reference-adapter.ts -- maps existing Reference types to/from KBEntry
    schema.ts          -- DDL for kb tables
```
