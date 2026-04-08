/** Contract: contracts/kb/rules.md */
import { z } from 'zod';
import { AuthorSchema } from '../references/contract.ts';

// --- Entry Type ---

export const KB_ENTRY_TYPES = [
  'reference',
  'entity',
  'dataset',
  'note',
  'glossary',
] as const;

export const KbEntryTypeSchema = z.enum(KB_ENTRY_TYPES);
export type KbEntryType = z.infer<typeof KbEntryTypeSchema>;

// --- Corpus Partition ---

export const KB_CORPUS_VALUES = ['knowledge', 'operational', 'reference'] as const;
export const KbCorpusSchema = z.enum(KB_CORPUS_VALUES);
export type KbCorpus = z.infer<typeof KbCorpusSchema>;

// --- Lifecycle ---

export const KB_LIFECYCLE_VALUES = ['draft', 'published', 'archived'] as const;
export const KbLifecycleSchema = z.enum(KB_LIFECYCLE_VALUES);
export type KbLifecycle = z.infer<typeof KbLifecycleSchema>;

/** Valid lifecycle transitions: draft->published, published->archived */
export const VALID_LIFECYCLE_TRANSITIONS: Record<KbLifecycle, KbLifecycle[]> = {
  draft: ['published'],
  published: ['archived'],
  archived: [],
};

// --- Dataset Column ---

export const DatasetColumnSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  description: z.string().optional(),
});

export type DatasetColumn = z.infer<typeof DatasetColumnSchema>;

// --- Entry type-specific content ---

export const ReferenceContentSchema = z.object({
  authors: z.array(AuthorSchema).default([]),
  abstract: z.string().nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
});

export const EntityContentSchema = z.object({
  description: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export const DatasetContentSchema = z.object({
  description: z.string().min(1),
  columns: z.array(DatasetColumnSchema).default([]),
  summary: z.string().nullable().default(null),
});

export const NoteContentSchema = z.object({
  content: z.string().min(1),
});

export const GlossaryContentSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

// --- KbEntry (full record) ---

const uuidSchema = z.string().uuid();

export const KbEntryBaseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  entryType: KbEntryTypeSchema,
  corpus: KbCorpusSchema,
  lifecycle: KbLifecycleSchema,
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const KbEntrySchema = KbEntryBaseSchema.extend({
  content: z.union([
    ReferenceContentSchema,
    EntityContentSchema,
    DatasetContentSchema,
    NoteContentSchema,
    GlossaryContentSchema,
  ]),
});

export type KbEntry = z.infer<typeof KbEntrySchema>;

// --- Create Input ---

export const KbEntryCreateInputSchema = z.object({
  title: z.string().min(1),
  entryType: KbEntryTypeSchema,
  corpus: KbCorpusSchema.default('knowledge'),
  tags: z.array(z.string()).default([]),
  content: z.union([
    ReferenceContentSchema,
    EntityContentSchema,
    DatasetContentSchema,
    NoteContentSchema,
    GlossaryContentSchema,
  ]),
});

export type KbEntryCreateInput = z.infer<typeof KbEntryCreateInputSchema>;

// --- Update Input (content + metadata only, not type/corpus) ---

export const KbEntryUpdateInputSchema = z.object({
  title: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  content: z.union([
    ReferenceContentSchema.partial(),
    EntityContentSchema.partial(),
    DatasetContentSchema.partial(),
    NoteContentSchema.partial(),
    GlossaryContentSchema.partial(),
  ]).optional(),
});

export type KbEntryUpdateInput = z.infer<typeof KbEntryUpdateInputSchema>;
