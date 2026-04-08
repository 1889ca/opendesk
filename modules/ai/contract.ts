/** Contract: contracts/ai/rules.md */
import { z } from 'zod';

// --- Source & Extractor Types ---

export const SOURCE_TYPES = ['document', 'kb-entry'] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const EXTRACTOR_TYPES = [
  'text', 'spreadsheet', 'presentation',
  'kb-reference', 'kb-entity', 'kb-dataset', 'kb-note', 'kb-glossary',
] as const;
export const ExtractorTypeSchema = z.enum(EXTRACTOR_TYPES);
export type ExtractorType = z.infer<typeof ExtractorTypeSchema>;

// --- RAG Corpus Filter ---

export const RAG_CORPUS_FILTER = ['knowledge', 'reference'] as const;

// --- Model Provider ---

export interface ModelProvider {
  embed(text: string): Promise<number[]>;
  generate(prompt: string, context?: string): Promise<string>;
}

// --- Text Extractor ---

export interface TextExtractor<T = unknown> {
  (input: T): string;
}

// --- Config ---

export const AiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ollamaUrl: z.string().url().default('http://localhost:11434'),
  embeddingModel: z.string().default('all-minilm'),
  chatModel: z.string().default('llama3.2'),
  chunkSize: z.coerce.number().int().positive().default(512),
  chunkOverlap: z.coerce.number().int().nonnegative().default(64),
  embeddingDimensions: z.coerce.number().int().positive().default(384),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

// --- Embedder Config ---

export const EmbedderConfigSchema = z.object({
  chunkSize: z.coerce.number().int().positive().default(512),
  chunkOverlap: z.coerce.number().int().nonnegative().default(64),
  embeddingDimensions: z.coerce.number().int().positive().default(768),
});

export type EmbedderConfig = z.infer<typeof EmbedderConfigSchema>;

// --- Embedding Record ---

export const EmbeddingRecordSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().min(1),
  sourceType: SourceTypeSchema,
  workspaceId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  chunkText: z.string().min(1),
  createdAt: z.string(),
});

export type EmbeddingRecord = z.infer<typeof EmbeddingRecordSchema>;

// --- Embedding Chunk (legacy) ---

export const EmbeddingChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  updatedAt: z.string(),
});

export type EmbeddingChunk = z.infer<typeof EmbeddingChunkSchema>;

// --- Semantic Search ---

export const SemanticSearchResultSchema = z.object({
  sourceId: z.string(),
  sourceType: SourceTypeSchema,
  chunkText: z.string(),
  similarity: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

// --- RAG Query Options ---

export const RagQueryOptionsSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().default(10),
  kbBoostFactor: z.coerce.number().positive().default(1.5),
  includeDocuments: z.boolean().default(true),
  includeKb: z.boolean().default(true),
});

export type RagQueryOptions = z.infer<typeof RagQueryOptionsSchema>;

// --- Assistant ---

export const AssistantResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(SemanticSearchResultSchema),
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

// --- Module Interface ---

export interface AiModule {
  /** Embed (or re-embed) a document's content into vector chunks. */
  embedDocument(documentId: string): Promise<number>;
  /** Semantic search across permitted documents. */
  semanticSearch(query: string, allowedDocumentIds: string[], limit?: number): Promise<SemanticSearchResult[]>;
  /** RAG-based document assistant. */
  ask(question: string, allowedDocumentIds: string[]): Promise<AssistantResponse>;
  /** Check if the Ollama backend is reachable. */
  healthCheck(): Promise<boolean>;
  /** Start the EventBus consumer for auto-embedding on StateFlushed events. */
  startConsumer(): void;
  /** Stop the EventBus consumer. */
  stopConsumer(): void;
}
