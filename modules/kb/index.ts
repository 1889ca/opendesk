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
