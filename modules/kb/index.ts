/** Contract: contracts/kb/rules.md */

// Public types and schemas
export {
  EntryType,
  RelationType,
  EntitySubtype,
  EntryTypeSchema,
  EntitySubtypeSchema,
  ReferenceMetadataSchema,
  EntityMetadataSchema,
  DatasetMetadataSchema,
  NoteMetadataSchema,
  CreateEntryInputSchema,
  UpdateEntryInputSchema,
  CreateRelationshipInputSchema,
  KBQueryFilterSchema,
  getMetadataSchema,
  normalizeTags,
  referenceToEntry,
  entryToReference,
} from './contract.ts';

export { CorpusPartitionSchema } from './internal/schemas.ts';
export type { CorpusPartition } from './internal/types.ts';

export type {
  KBEntry,
  KBRelationship,
  KBQueryFilter,
  KBSearchResult,
  KBVersionRecord,
  ReferenceMetadata,
  EntityMetadata,
  DatasetMetadata,
  NoteMetadata,
  CreateEntryInput,
  UpdateEntryInput,
  CreateRelationshipInput,
  LegacyReference,
} from './contract.ts';

// Store factories (DI-friendly) — callers pass pool and get a store object
export { createKbEntriesStore } from './internal/entries-store.ts';
export type { KbEntriesStore } from './internal/entries-store.ts';

export { createKbRelationshipStore } from './internal/relationships-store.ts';
export type { KbRelationshipStore } from './internal/relationships-store.ts';

export { createKbSearchStore } from './internal/search.ts';
export type { KbSearchStore } from './internal/search.ts';

export { createKbReverseDepsStore } from './internal/reverse-deps.ts';
export type { KbReverseDepsStore } from './internal/reverse-deps.ts';

export { createKbEntryStore } from './internal/pg-entries.ts';
export type { KbEntryStore } from './internal/pg-entries.ts';

export { createKbVersionStore } from './internal/pg-versions.ts';
export type { KbVersionStore } from './internal/pg-versions.ts';

export { createKbEntityStore } from './internal/pg-entities.ts';
export type { KbEntityStore } from './internal/pg-entities.ts';

export { createKbDatasetStore } from './internal/pg-datasets.ts';
export type { KbDatasetStore } from './internal/pg-datasets.ts';

export { createKbSnapshotStore } from './internal/pg-snapshots.ts';
export type { KbSnapshotStore } from './internal/pg-snapshots.ts';

// Public API — lifecycle validation
export { validateTransition } from './internal/lifecycle.ts';

// Public API — reference resolution (takes store args)
export {
  resolveReference,
  parseKbUri,
  buildKbUri,
} from './internal/resolve-ref.ts';

// Zod schemas for KB entry CRUD (used by api routes)
export {
  CreateEntryInputSchema as KbEntryCreateInputSchema,
  UpdateEntryInputSchema as KbEntryUpdateInputSchema,
} from './internal/schemas.ts';

// Schema initialization (takes pool)
export { initKBSchema } from './internal/schema.ts';

// Entity directory schemas and types
export {
  KBEntitySchema,
  KBEntitySummarySchema,
  EntityCreateInputSchema,
  EntityUpdateInputSchema,
  PersonContentSchema,
  OrganizationContentSchema,
  ProjectContentSchema,
  TermContentSchema,
  ENTITY_SUBTYPES,
  contentSchemaForSubtype,
} from './contract.ts';

export type {
  KBEntitySummary,
  EntityCreateInput,
  EntityUpdateInput,
  PersonContent,
  OrganizationContent,
  ProjectContent,
  TermContent,
  KbEntryStatus,
  KbVersionRef,
  ResolvedReference,
} from './contract.ts';

export {
  KbEntryStatusSchema,
  STATUS_TRANSITIONS,
} from './contract.ts';

// Content validation
export {
  validateContent,
  validateContentSafe,
} from './internal/validate-content.ts';

// Row types (for consumers that need the DB shape)
export type { EntityRow, EntityUpdates } from './internal/pg-entities.ts';
export type { DatasetRow, DatasetRowInput } from './internal/pg-datasets.ts';
export type { KbVersionRow } from './internal/pg-versions.ts';
export type { KbEntryRow, KbEntryFields } from './internal/pg-entries.ts';

// Snapshot types
export type { KBSnapshot, EntryVersionMap, SnapshotEntry } from './internal/snapshot-types.ts';
