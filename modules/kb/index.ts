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
