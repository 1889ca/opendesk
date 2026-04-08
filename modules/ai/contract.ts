/** Contract: contracts/ai/rules.md */
import { z } from 'zod';

// --- Source Type ---

export const SOURCE_TYPES = ['document', 'kb-entry'] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;

// --- Extractor Type ---

export const EXTRACTOR_TYPES = [
  'text',
  'spreadsheet',
  'presentation',
  'kb-reference',
  'kb-entity',
  'kb-dataset',
  'kb-note',
  'kb-glossary',
] as const;

export const ExtractorTypeSchema = z.enum(EXTRACTOR_TYPES);
export type ExtractorType = z.infer<typeof ExtractorTypeSchema>;

// --- Embedding Record ---

export const EmbeddingRecordSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().min(1),
  sourceType: SourceTypeSchema,
  workspaceId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  chunkText: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type EmbeddingRecord = z.infer<typeof EmbeddingRecordSchema>;

// --- Semantic Search Result ---

export const SemanticSearchResultSchema = z.object({
  sourceId: z.string(),
  sourceType: SourceTypeSchema,
  chunkText: z.string(),
  similarity: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).default({}),
});

export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

// --- RAG Query Options ---

export const RAG_CORPUS_FILTER = ['knowledge', 'reference'] as const;

export const RagQueryOptionsSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  kbBoostFactor: z.number().positive().default(1.5),
  includeDocuments: z.boolean().default(true),
  includeKb: z.boolean().default(true),
});

export type RagQueryOptions = z.infer<typeof RagQueryOptionsSchema>;

// --- BYOM Provider Interface ---

export interface ModelProvider {
  /** Generate an embedding vector for the given text. */
  embed(text: string): Promise<number[]>;
  /** Generate text from a prompt with optional context. */
  generate(prompt: string, context?: string): Promise<string>;
}

// --- Text Extractor ---

export type TextExtractor<T = unknown> = (source: T) => string;

// --- Embedder Configuration ---

export const EmbedderConfigSchema = z.object({
  chunkSize: z.number().int().positive().default(512),
  chunkOverlap: z.number().int().nonnegative().default(64),
  embeddingDimensions: z.number().int().positive().default(768),
});

export type EmbedderConfig = z.infer<typeof EmbedderConfigSchema>;
