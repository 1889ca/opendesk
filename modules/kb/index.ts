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

// Public API — entry operations
export {
  createEntry,
  getEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  getVersionHistory,
} from './internal/entries-store.ts';

// Public API — relationship operations
export {
  createRelationship,
  deleteRelationship,
  getRelationships,
  getRelationshipById,
} from './internal/relationships-store.ts';

// Public API — search
export { searchEntries } from './internal/search.ts';

// Public API — reverse dependencies
export { getReverseDependencies } from './internal/reverse-deps.ts';

// Public API — lifecycle (pg-entries status + versions)
export {
  listPublishedEntries,
  transitionStatus,
} from './internal/pg-entries.ts';

// Public API — lifecycle validation
export { validateTransition } from './internal/lifecycle.ts';

// Public API — version resolution
export {
  listVersions as listEntryVersions,
  getVersion as getEntryVersion,
} from './internal/pg-versions.ts';

// Public API — reference resolution
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

// Schema initialization
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

// Entity CRUD
export {
  createEntity,
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity,
  searchEntities,
} from './internal/pg-entities.ts';

// Content validation
export {
  validateContent,
  validateContentSafe,
} from './internal/validate-content.ts';

// Dataset row operations
export {
  insertRows,
  getRows,
  getRowCount,
  updateRow,
  deleteRow,
  clearRows,
  replaceRows,
} from './internal/pg-datasets.ts';

// Row types
export type { EntityRow, EntityUpdates } from './internal/pg-entities.ts';
export type { DatasetRow, DatasetRowInput } from './internal/pg-datasets.ts';

// Snapshot operations
export {
  createSnapshot,
  getSnapshot,
  listSnapshots,
  getSnapshotEntries,
} from './internal/pg-snapshots.ts';

// Snapshot types
export type { KBSnapshot, EntryVersionMap, SnapshotEntry } from './internal/snapshot-types.ts';
