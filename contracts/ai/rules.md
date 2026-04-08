# Contract: ai

## Purpose

Provide the local AI infrastructure for OpenDesk: BYOM (Bring Your Own Model) abstraction over Ollama, document/KB text extraction, vector embedding pipeline, and RAG-enhanced semantic search. All AI operations run locally -- no data leaves the deployment.

## Inputs

- `documentId`: `string` -- Document to extract text from and embed.
- `kbEntryId`: `string` -- KB entry to extract text from and embed.
- `query`: `string` -- Natural language query for semantic search.
- `workspaceId`: `string` -- Scopes all operations to a workspace.
- `snapshot`: `DocumentSnapshot` -- Document content to extract text from.

## Outputs

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

## Side Effects

- Reads/writes embedding vectors to pgvector in PostgreSQL.
- Calls Ollama API for embedding generation and text generation.
- Subscribes to events for automatic re-embedding on document/KB updates.

## Invariants

1. **No data leaves the deployment.** All model calls go to local Ollama.
2. **Source type discriminates embeddings.** Every embedding record has a `sourceType` field.
3. **KB entries only embed when published.** Draft and archived entries are not embedded.
4. **Corpus filtering in RAG.** Only `knowledge` and `reference` corpus entries feed RAG queries.
5. **KB entries receive higher relevance weighting in RAG.** Configurable boost factor.
6. **Extractors are registered, not hardcoded.** New document types register via the registry.
7. **Chunks are idempotent.** Re-embedding the same source replaces previous chunks.

## Dependencies

- `storage` -- Provides the PostgreSQL connection pool (pgvector extension).
- `document` -- Provides `DocumentSnapshot` types for extraction.
- `kb` -- Provides `KbEntry` types for extraction.
- `events` -- Subscribes to document/KB update events for automatic re-embedding.
- `config` -- Provides Ollama connection configuration.

## Boundary Rules

- MUST: Use pgvector for vector storage (not a separate vector DB).
- MUST: Extract text via registered extractors, never hardcoded per-type logic in the pipeline.
- MUST: Replace all existing chunks when re-embedding a source (idempotent).
- MUST: Filter KB entries by lifecycle=published before embedding.
- MUST: Filter KB entries by corpus in ['knowledge', 'reference'] for RAG queries.
- MUST: Apply configurable relevance boost to KB results in RAG.
- MUST NOT: Call external APIs. All model operations are local (Ollama).
- MUST NOT: Embed draft or archived KB entries.
- MUST NOT: Handle HTTP requests or routing. That belongs to `api`.

## Verification

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
