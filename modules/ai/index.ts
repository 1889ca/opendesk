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
  ASSIST_ACTIONS,
  AssistActionSchema,
  AssistRequestSchema,
  ModelCapabilitySchema,
  QualityTierSchema,
  UseCaseTagSchema,
  HardwareReqsSchema,
  ModelZooEntrySchema,
  CustomModelSchema,
  ModelConfigSchema,
  OllamaModelInfoSchema,
  PullProgressSchema,
  type AiConfig,
  type EmbeddingChunk,
  type SemanticSearchResult,
  type AssistantResponse,
  type AssistAction,
  type AssistRequest,
  type AssistResult,
  type AiModule,
  type SourceType,
  type ExtractorType,
  type ModelProvider,
  type EmbedderConfig,
  type EmbeddingRecord,
  type RagQueryOptions,
  type TextExtractor,
  type ModelCapability,
  type QualityTier,
  type UseCaseTag,
  type HardwareReqs,
  type ModelZooEntry,
  type CustomModel,
  type ModelConfig,
  type OllamaModelInfo,
  type PullProgress,
} from './contract.ts';

// Factory
export { createAi, type AiDependencies } from './internal/create-ai.ts';

// Routes
export { createAiRoutes } from './internal/ai-routes.ts';

// EventBus consumer
export { createEmbeddingConsumer, type EmbeddingConsumer } from './internal/embedding-consumer.ts';

// Utilities
export { chunkText } from './internal/chunker.ts';
export { extractDocumentText } from './internal/document-extractor.ts';

// Zoo
export { loadZoo, findZooEntry } from './internal/zoo-loader.ts';

// Ollama client
export { createOllamaClient } from './internal/ollama-client.ts';
export type { OllamaClient } from './internal/ollama-client.ts';

// Config store
export { ensureAiSchema, getModelConfig, setActiveModel } from './internal/config-store.ts';

// Model service
export { createModelService } from './internal/model-service.ts';
export type { ModelService, ModelListItem } from './internal/model-service.ts';
