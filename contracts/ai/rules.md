# Contract: ai

## Purpose

Air-gapped local AI module providing a BYOM (Bring Your Own Model) abstraction over Ollama for document embeddings, semantic search, and RAG-based document assistance. All inference stays within the sovereign deployment boundary.

## Inputs

- Document text content (extracted from Yjs state or ProseMirror snapshots)
- User queries (natural language search or questions)
- Ollama endpoint URL and model identifiers (via config)
- `allowedDocumentIds` — permission-filtered document scope

## Outputs

- `EmbeddingChunk`: `{ id, documentId, chunkIndex, content, embedding (vector), updatedAt }` — A stored text chunk with its vector embedding.
- `SemanticSearchResult`: `{ documentId, title, chunkContent, similarity }` — A search result ranked by cosine similarity.
- `AssistantResponse`: `{ answer, sources: SemanticSearchResult[] }` — A RAG-generated response with attribution.

## Side Effects

- Stores embeddings in `document_embeddings` table (pgvector).
- Calls Ollama HTTP API for embedding generation and LLM inference.
- Subscribes to `StateFlushed` events to trigger re-embedding.

## Invariants

- All LLM/embedding calls go through the BYOM abstraction (never direct HTTP).
- No data leaves the configured Ollama endpoint (sovereign boundary).
- Embedding pipeline is read-only on document data (never mutates documents).
- Semantic search respects the same permission filtering as tsvector search.
- Ollama failures are graceful — semantic search falls back to empty results, not crashes.
- Chunk size is configurable, default 512 tokens.

## Dependencies

- `config` — Provides AI configuration (Ollama URL, model names, chunk size).
- `storage` — PG pool for embedding storage, document loading.
- `logger` — Structured logging.
- `events` — EventBus subscription for re-embedding triggers.

## Boundary Rules

- MUST: Route all inference through the BYOM abstraction layer.
- MUST: Enforce permission filtering on all search/RAG endpoints.
- MUST: Handle Ollama unavailability gracefully (log, return empty, don't crash).
- MUST: Support configurable embedding and chat model names.
- MUST NOT: Send document content to any external endpoint other than the configured Ollama instance.
- MUST NOT: Mutate document content or state.
- MUST NOT: Cache or persist LLM responses (stateless inference).

## Verification

- BYOM abstraction: Mock Ollama endpoint, verify embedding generation returns correct shape.
- Permission filtering: Embed docs for user A, semantic search as user B, verify no cross-leak.
- Graceful degradation: Kill Ollama, verify semantic search returns empty (not error).
- Chunk consistency: Embed document, modify, re-embed, verify old chunks replaced.
- RAG attribution: Verify assistant response includes source chunks with document IDs.
Provide the local AI infrastructure for OpenDesk: BYOM (Bring Your Own Model) abstraction over Ollama, document/KB text extraction, vector embedding pipeline, and RAG-enhanced semantic search. All AI operations run locally -- no data leaves the deployment.
- `documentId`: `string` -- Document to extract text from and embed.
- `kbEntryId`: `string` -- KB entry to extract text from and embed.
- `query`: `string` -- Natural language query for semantic search.
- `workspaceId`: `string` -- Scopes all operations to a workspace.
- `snapshot`: `DocumentSnapshot` -- Document content to extract text from.
### Extractor Registry
A type-keyed registry of text extractors. Each extractor takes a typed document/entry and returns plain text for embedding.
```typescript
type ExtractorType = 'text' | 'spreadsheet' | 'presentation' | 'kb-reference' | 'kb-entity' | 'kb-dataset' | 'kb-note' | 'kb-glossary';
type TextExtractor<T> = (source: T) => string;
type ExtractorRegistry = Map<ExtractorType, TextExtractor<unknown>>;
```
### Embedding Result
```typescript
type EmbeddingRecord = {
  id: string;                    // UUIDv4
  sourceId: string;              // document ID or KB entry ID
  sourceType: 'document' | 'kb-entry';
  workspaceId: string;
  chunkIndex: number;            // position within the source
  chunkText: string;             // the text that was embedded
  embedding: number[];           // vector
  createdAt: string;             // ISO 8601
};
```
### Semantic Search Result
```typescript
type SemanticSearchResult = {
  sourceId: string;
  sourceType: 'document' | 'kb-entry';
  chunkText: string;
  similarity: number;            // 0.0 to 1.0
  metadata: Record<string, unknown>;
};
```
### BYOM Provider
```typescript
type ModelProvider = {
  embed(text: string): Promise<number[]>;
  generate(prompt: string, context?: string): Promise<string>;
};
```
- Reads/writes embedding vectors to pgvector in PostgreSQL.
- Calls Ollama API for embedding generation and text generation.
- Subscribes to events for automatic re-embedding on document/KB updates.
1. **No data leaves the deployment.** All model calls go to local Ollama.
2. **Source type discriminates embeddings.** Every embedding record has a `sourceType` field.
3. **KB entries only embed when published.** Draft and archived entries are not embedded.
4. **Corpus filtering in RAG.** Only `knowledge` and `reference` corpus entries feed RAG queries.
5. **KB entries receive higher relevance weighting in RAG.** Configurable boost factor.
6. **Extractors are registered, not hardcoded.** New document types register via the registry.
7. **Chunks are idempotent.** Re-embedding the same source replaces previous chunks.
- `storage` -- Provides the PostgreSQL connection pool (pgvector extension).
- `document` -- Provides `DocumentSnapshot` types for extraction.
- `kb` -- Provides `KbEntry` types for extraction.
- `events` -- Subscribes to document/KB update events for automatic re-embedding.
- `config` -- Provides Ollama connection configuration.
- MUST: Use pgvector for vector storage (not a separate vector DB).
- MUST: Extract text via registered extractors, never hardcoded per-type logic in the pipeline.
- MUST: Replace all existing chunks when re-embedding a source (idempotent).
- MUST: Filter KB entries by lifecycle=published before embedding.
- MUST: Filter KB entries by corpus in ['knowledge', 'reference'] for RAG queries.
- MUST: Apply configurable relevance boost to KB results in RAG.
- MUST NOT: Call external APIs. All model operations are local (Ollama).
- MUST NOT: Embed draft or archived KB entries.
- MUST NOT: Handle HTTP requests or routing. That belongs to `api`.
- No external calls -> Code audit: grep for non-localhost HTTP calls.
- Source type discrimination -> Unit test: embed doc and KB entry, query, verify sourceType.
- Published-only embedding -> Unit test: attempt embed of draft entry, verify rejection.
- Corpus filtering -> Unit test: embed knowledge + operational entries, query RAG, verify only knowledge/reference returned.
- KB relevance boost -> Unit test: verify KB results have boosted similarity scores.
- Extractor registry -> Unit test: register extractor, extract text, verify output.
- Idempotent re-embedding -> Integration test: embed, re-embed, verify chunk count unchanged.
## File Structure
```
modules/ai/
  contract.ts          -- Zod schemas, inferred types, interfaces
  index.ts             -- re-exports public API
  internal/
    extractors.ts      -- text extractor registry and built-in extractors
    kb-extractors.ts   -- KB entry type extractors
    embedder.ts        -- chunking and embedding pipeline
    vector-store.ts    -- pgvector read/write operations
    ollama-provider.ts -- BYOM Ollama adapter
    rag.ts             -- RAG query engine with corpus filtering
```
