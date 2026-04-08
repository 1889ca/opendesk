/** Contract: contracts/kb/rules.md */

// --- Types ---
export type {
  KBEntry,
  KBRelationship,
  KBQueryFilter,
  KBSearchResult,
  KBVersionRecord,
} from './internal/types.ts';

export {
  EntryType,
  RelationType,
  EntitySubtype,
} from './internal/types.ts';

// --- Zod Schemas ---
export {
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
} from './internal/schemas.ts';

export type {
  ReferenceMetadata,
  EntityMetadata,
  DatasetMetadata,
  NoteMetadata,
  CreateEntryInput,
  UpdateEntryInput,
  CreateRelationshipInput,
} from './internal/schemas.ts';

// --- Reference adapter ---
export type { LegacyReference } from './internal/reference-adapter.ts';
export { referenceToEntry, entryToReference } from './internal/reference-adapter.ts';
