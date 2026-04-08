/** Contract: contracts/ai/rules.md */
import type { Pool } from 'pg';
import type { EventBusModule } from '../../events/contract.ts';
import type { AiModule, AiConfig, SemanticSearchResult, AssistantResponse } from '../contract.ts';
import { createOllamaClient, type OllamaClient } from './ollama-client.ts';
import { extractDocumentText } from './document-extractor.ts';
import { chunkText } from './chunker.ts';
import { upsertEmbeddings, searchByVector } from './embedding-store.ts';
import { createEmbeddingConsumer, type EmbeddingConsumer } from './embedding-consumer.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('ai');

export interface AiDependencies {
  pool: Pool;
  config: AiConfig;
  eventBus?: EventBusModule;
}

const RAG_SYSTEM_PROMPT = `You are a helpful document assistant for OpenDesk, a sovereign office suite. Answer the user's question based ONLY on the provided document excerpts. If the excerpts don't contain enough information, say so. Always cite which document your answer comes from. Be concise and direct.`;

/**
 * Factory: creates the AI module with BYOM abstraction.
 * All inference stays within the configured Ollama endpoint.
 */
export function createAi(deps: AiDependencies): AiModule {
  const { pool, config, eventBus } = deps;

  const ollama: OllamaClient = createOllamaClient({
    baseUrl: config.ollamaUrl,
    embeddingModel: config.embeddingModel,
    chatModel: config.chatModel,
  });

  async function embedDocument(documentId: string): Promise<number> {
    const text = await extractDocumentText(documentId);
    if (!text.trim()) {
      log.info('no content to embed', { documentId });
      return 0;
    }

    const chunks = chunkText(text, config.chunkSize, config.chunkOverlap);
    log.info('embedding document', { documentId, chunks: chunks.length });

    const embeddedChunks = [];
    for (const chunk of chunks) {
      try {
        const embedding = await ollama.embed(chunk.content);
        embeddedChunks.push({
          index: chunk.index,
          content: chunk.content,
          embedding,
        });
      } catch (err) {
        log.error('embedding chunk failed', {
          documentId,
          chunkIndex: chunk.index,
          error: String(err),
        });
      }
    }

    if (embeddedChunks.length > 0) {
      await upsertEmbeddings(pool, documentId, embeddedChunks);
    }

    log.info('embedding complete', {
      documentId,
      embedded: embeddedChunks.length,
      total: chunks.length,
    });

    return embeddedChunks.length;
  }

  async function semanticSearch(
    query: string,
    allowedDocumentIds: string[],
    limit = 10,
  ): Promise<SemanticSearchResult[]> {
    try {
      const queryEmbedding = await ollama.embed(query);
      return searchByVector(pool, queryEmbedding, allowedDocumentIds, limit);
    } catch (err) {
      log.error('semantic search failed', { error: String(err) });
      return [];
    }
  }

  async function ask(
    question: string,
    allowedDocumentIds: string[],
  ): Promise<AssistantResponse> {
    // 1. Find relevant chunks via semantic search
    const sources = await semanticSearch(question, allowedDocumentIds, 5);

    if (sources.length === 0) {
      return {
        answer: 'I could not find relevant information in your documents to answer this question.',
        sources: [],
      };
    }

    // 2. Build context from top chunks
    const context = sources
      .map((s, i) => `[Source ${i + 1}: "${(s.metadata as Record<string, unknown>)?.title ?? s.sourceId}"] ${s.chunkText}`)
      .join('\n\n---\n\n');

    // 3. Generate answer via LLM
    const userMessage = `Document excerpts:\n\n${context}\n\n---\n\nQuestion: ${question}`;

    try {
      const answer = await ollama.chat(RAG_SYSTEM_PROMPT, userMessage);
      return { answer, sources };
    } catch (err) {
      log.error('assistant failed', { error: String(err) });
      return {
        answer: 'The AI assistant is currently unavailable. Please try again later.',
        sources,
      };
    }
  }

  async function healthCheck(): Promise<boolean> {
    return ollama.ping();
  }

  // Build embedding consumer if eventBus is available
  let consumer: EmbeddingConsumer | null = null;
  if (eventBus) {
    consumer = createEmbeddingConsumer(eventBus, embedDocument);
  }

  function startConsumer(): void {
    if (!consumer) {
      log.warn('no eventBus provided — embedding consumer not available');
      return;
    }
    consumer.start().catch((err) => {
      log.error('failed to start embedding consumer', { error: String(err) });
    });
  }

  function stopConsumer(): void {
    if (consumer) {
      consumer.stop();
    }
  }

  return { embedDocument, semanticSearch, ask, healthCheck, startConsumer, stopConsumer };
}
