/** Contract: contracts/kb/rules.md */
export {
  // Enums and constants
  KB_ENTRY_TYPES,
  KB_CORPUS_VALUES,
  KB_LIFECYCLE_VALUES,
  VALID_LIFECYCLE_TRANSITIONS,

  // Schemas
  KbEntryTypeSchema,
  KbCorpusSchema,
  KbLifecycleSchema,
  DatasetColumnSchema,
  ReferenceContentSchema,
  EntityContentSchema,
  DatasetContentSchema,
  NoteContentSchema,
  GlossaryContentSchema,
  KbEntryBaseSchema,
  KbEntrySchema,
  KbEntryCreateInputSchema,
  KbEntryUpdateInputSchema,

  // Types
  type KbEntryType,
  type KbCorpus,
  type KbLifecycle,
  type DatasetColumn,
  type KbEntry,
  type KbEntryCreateInput,
  type KbEntryUpdateInput,
} from './contract.ts';

// --- CRUD operations ---
export {
  createEntry,
  getEntry,
  listEntries,
  updateEntry,
  transitionLifecycle,
  deleteEntry,
} from './internal/pg-kb.ts';
