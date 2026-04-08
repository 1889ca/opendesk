/** Contract: contracts/kb/rules.md */
import { z } from 'zod';

// --- Entry Type Schema ---

export const EntryTypeSchema = z.enum(['reference', 'entity', 'dataset', 'note']);

export const EntitySubtypeSchema = z.enum(['person', 'organization', 'place']);

// --- Type-Specific Metadata Schemas ---

/** Reference metadata: bibliographic data (DOI, authors, journal, etc.) */
export const ReferenceMetadataSchema = z.object({
  doi: z.string().optional(),
  authors: z.array(z.string()).default([]),
  journal: z.string().optional(),
  year: z.number().int().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  abstract: z.string().optional(),
  url: z.string().url().optional(),
  publisher: z.string().optional(),
});

export type ReferenceMetadata = z.infer<typeof ReferenceMetadataSchema>;

/** Entity metadata: person, organization, or place. */
export const EntityMetadataSchema = z.object({
  entityType: EntitySubtypeSchema,
  description: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  externalIds: z.record(z.string()).default({}),
  properties: z.record(z.unknown()).default({}),
});

export type EntityMetadata = z.infer<typeof EntityMetadataSchema>;

/** Dataset metadata: pointer to structured data. */
export const DatasetMetadataSchema = z.object({
  format: z.string().min(1),
  schema: z.string().optional(),
  rowCount: z.number().int().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
  description: z.string().optional(),
  columns: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    description: z.string().optional(),
  })).default([]),
});

export type DatasetMetadata = z.infer<typeof DatasetMetadataSchema>;

/** Note metadata: freeform text content. */
export const NoteMetadataSchema = z.object({
  body: z.string().default(''),
  format: z.enum(['plain', 'markdown', 'html']).default('markdown'),
  pinned: z.boolean().default(false),
});

export type NoteMetadata = z.infer<typeof NoteMetadataSchema>;

// --- Metadata discriminator by entry type ---

const metadataByType = {
  reference: ReferenceMetadataSchema,
  entity: EntityMetadataSchema,
  dataset: DatasetMetadataSchema,
  note: NoteMetadataSchema,
} as const;

export function getMetadataSchema(entryType: string): z.ZodType {
  const schema = metadataByType[entryType as keyof typeof metadataByType];
  if (!schema) {
    throw new Error(`Unknown entry type: ${entryType}`);
  }
  return schema;
}

// --- Tag normalization ---

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

// --- Corpus & Jurisdiction ---

export const CorpusPartitionSchema = z.enum(['knowledge', 'operational', 'reference']);
export type CorpusPartition = z.infer<typeof CorpusPartitionSchema>;

// --- Shared field schemas ---

const uuidSchema = z.string().uuid();
const tagsSchema = z.array(z.string().min(1)).default([]);

// --- Entry input schemas ---

export const CreateEntryInputSchema = z.object({
  workspaceId: uuidSchema,
  entryType: EntryTypeSchema,
  title: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).default({}),
  tags: tagsSchema,
  corpus: CorpusPartitionSchema.default('knowledge'),
  jurisdiction: z.string().max(20).nullable().default(null),
  createdBy: z.string().min(1),
});

export type CreateEntryInput = z.infer<typeof CreateEntryInputSchema>;

export const UpdateEntryInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: tagsSchema.optional(),
  corpus: CorpusPartitionSchema.optional(),
  jurisdiction: z.string().max(20).nullable().optional(),
  updatedBy: z.string().min(1),
});

export type UpdateEntryInput = z.infer<typeof UpdateEntryInputSchema>;

// --- Relationship input schemas ---

export const CreateRelationshipInputSchema = z.object({
  workspaceId: uuidSchema,
  sourceId: uuidSchema,
  targetId: uuidSchema,
  relationType: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).default({}),
});

export type CreateRelationshipInput = z.infer<typeof CreateRelationshipInputSchema>;

// --- Query filter schema ---

export const KBQueryFilterSchema = z.object({
  entryType: EntryTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  corpus: CorpusPartitionSchema.optional(),
  jurisdiction: z.string().max(20).optional(),
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().nonnegative().default(0),
});
