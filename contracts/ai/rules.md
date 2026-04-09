# Contract: ai

## Purpose

Air-gapped local AI module providing a BYOM (Bring Your Own Model) abstraction over Ollama for document embeddings, semantic search, RAG-based document assistance, and sovereign-safe AI model management with a curated model registry. All inference stays within the sovereign deployment boundary.

## Inputs

- Document text content (extracted from Yjs state or ProseMirror snapshots)
- User queries (natural language search or questions)
- Ollama endpoint URL and model identifiers (via config)
- `allowedDocumentIds` -- permission-filtered document scope
- `workspaceId` -- scopes all operations to a workspace
- Model zoo entries from `model-zoo.json`
- `pool` -- PostgreSQL connection pool for persisting model config

## Outputs

- `EmbeddingRecord`: Stored text chunk with vector embedding and source metadata.
- `SemanticSearchResult`: Search result ranked by cosine similarity.
- `AssistantResponse`: RAG-generated response with source attribution.
- `ModelZooEntry`: Curated model metadata (name, provider tag, capabilities, license, hardware reqs).
- `ModelConfig`: Per-workspace active model selection (embedding + generation).
- `OllamaModelInfo`: Installed model list from Ollama.

## Side Effects

- Stores embeddings in `document_embeddings` table (pgvector).
- Calls Ollama HTTP API for embedding generation and LLM inference.
- Subscribes to `StateFlushed` events to trigger re-embedding.
- Triggers Ollama `/api/pull` to download models.
- Triggers Ollama `/api/delete` to remove models.
- Writes to `ai_model_config` table for workspace model preferences.

## Invariants

- All LLM/embedding calls go through the BYOM abstraction (never direct HTTP).
- No data leaves the configured Ollama endpoint (sovereign boundary).
- Embedding pipeline is read-only on document data (never mutates documents).
- Semantic search respects the same permission filtering as tsvector search.
- Ollama failures are graceful -- semantic search falls back to empty results, not crashes.
- Chunk size is configurable, default 512 tokens.
- All zoo models must have permissive licenses (Apache 2.0, MIT, or open-weight).
- Only one embedding model and one generation model active per workspace at a time.
- KB entries only embed when published (not drafts or archived).

## Dependencies

- `config` -- Provides AI configuration (Ollama URL, model names, chunk size).
- `storage` -- PG pool for embedding storage, document loading, ai_model_config persistence.
- `logger` -- Structured logging.
- `events` -- EventBus subscription for re-embedding triggers.

## Boundary Rules

- MUST: Route all inference through the BYOM abstraction layer.
- MUST: Enforce permission filtering on all search/RAG endpoints.
- MUST: Handle Ollama unavailability gracefully (log, return empty, don't crash).
- MUST: Support configurable embedding and chat model names.
- MUST: Validate model IDs against zoo + custom registry before pull.
- MUST: Return real Ollama download progress, not synthetic.
- MUST: Use pgvector for vector storage (not a separate vector DB).
- MUST: Replace all existing chunks when re-embedding a source (idempotent).
- MUST NOT: Send document content to any external endpoint other than the configured Ollama instance.
- MUST NOT: Mutate document content or state.
- MUST NOT: Cache or persist LLM responses (stateless inference).
- MUST NOT: Ship models that require proprietary licenses.
- MUST NOT: Store model weights in PostgreSQL -- Ollama manages storage.

## Verification

- BYOM abstraction: Mock Ollama endpoint, verify embedding generation returns correct shape.
- Permission filtering: Embed docs for user A, semantic search as user B, verify no cross-leak.
- Graceful degradation: Kill Ollama, verify semantic search returns empty (not error).
- Chunk consistency: Embed document, modify, re-embed, verify old chunks replaced.
- RAG attribution: Verify assistant response includes source chunks with document IDs.
- Zoo JSON validates against schema (all required fields present, licenses permissive).
- Config persistence round-trips (save then load returns same model selection).
- Pull/delete proxy calls hit correct Ollama endpoints.

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
    ollama-client.ts   -- BYOM Ollama adapter (embed, chat, model management)
    rag.ts             -- RAG query engine with corpus filtering
    zoo-loader.ts      -- curated model registry loader
    config-store.ts    -- per-workspace model config persistence
    model-service.ts   -- model management service
    ai-routes.ts       -- API routes (RAG + model zoo management)
```
