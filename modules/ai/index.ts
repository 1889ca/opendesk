/** Contract: contracts/ai/rules.md */

// Schemas & types
export {
  AiConfigSchema,
  EmbeddingChunkSchema,
  SemanticSearchResultSchema,
  AssistantResponseSchema,
  EmbedderConfigSchema,
  EmbeddingRecordSchema,
  RagQueryOptionsSchema,
  SourceTypeSchema,
  ExtractorTypeSchema,
  SOURCE_TYPES,
  EXTRACTOR_TYPES,
  RAG_CORPUS_FILTER,
  type AiConfig,
  type EmbeddingChunk,
  type SemanticSearchResult,
  type AssistantResponse,
  type AiModule,
  type SourceType,
  type ExtractorType,
  type ModelProvider,
  type EmbedderConfig,
  type EmbeddingRecord,
  type RagQueryOptions,
  type TextExtractor,
} from './contract.ts';

// Factory
export { createAi, type AiDependencies } from './internal/create-ai.ts';

// Routes
export { createAiRoutes, type AiRoutesOptions } from './internal/ai-routes.ts';

// EventBus consumer
export { createEmbeddingConsumer, type EmbeddingConsumer } from './internal/embedding-consumer.ts';

// Utilities
export { chunkText } from './internal/chunker.ts';
export { extractDocumentText } from './internal/document-extractor.ts';
