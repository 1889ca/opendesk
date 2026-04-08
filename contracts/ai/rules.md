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
