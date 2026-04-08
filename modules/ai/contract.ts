/** Contract: contracts/ai/rules.md */
import { z } from 'zod';

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

// --- Embedding Chunk ---

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
  documentId: z.string(),
  title: z.string(),
  chunkContent: z.string(),
  similarity: z.number(),
});

export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

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
}
