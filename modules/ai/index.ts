/** Contract: contracts/ai/rules.md */
export {
  // Constants
  SOURCE_TYPES,
  EXTRACTOR_TYPES,
  RAG_CORPUS_FILTER,

  // Schemas
  SourceTypeSchema,
  ExtractorTypeSchema,
  EmbeddingRecordSchema,
  SemanticSearchResultSchema,
  RagQueryOptionsSchema,
  EmbedderConfigSchema,

  // Types
  type SourceType,
  type ExtractorType,
  type EmbeddingRecord,
  type SemanticSearchResult,
  type RagQueryOptions,
  type EmbedderConfig,
  type ModelProvider,
  type TextExtractor,
} from './contract.ts';

// --- Extractor registry ---
export {
  registerExtractor,
  getExtractor,
  listExtractorTypes,
  textDocumentExtractor,
  spreadsheetExtractor,
  presentationExtractor,
} from './internal/extractors.ts';

// --- KB extractors (registers on import) ---
export {
  kbReferenceExtractor,
  kbEntityExtractor,
  kbDatasetExtractor,
  kbNoteExtractor,
  kbGlossaryExtractor,
} from './internal/kb-extractors.ts';

// --- Embedder ---
export { chunkText, embedSource } from './internal/embedder.ts';

// --- Vector store ---
export {
  APPLY_EMBEDDINGS_SCHEMA,
  upsertChunks,
  deleteEmbeddings,
  searchSimilar,
} from './internal/vector-store.ts';

// --- BYOM provider ---
export {
  createOllamaProvider,
  type OllamaConfig,
} from './internal/ollama-provider.ts';

// --- RAG ---
export { ragQuery, ragAnswer } from './internal/rag.ts';
