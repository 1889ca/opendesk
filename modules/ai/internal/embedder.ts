/** Contract: contracts/ai/rules.md */
import type { Pool } from 'pg';
import type { ModelProvider, EmbedderConfig, SourceType } from '../contract.ts';
import { upsertChunks } from './vector-store.ts';

const DEFAULT_CONFIG: EmbedderConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
  embeddingDimensions: 768,
};

/** Split text into overlapping chunks for embedding. */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CONFIG.chunkSize,
  overlap: number = DEFAULT_CONFIG.chunkOverlap,
): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Embed text chunks and persist to vector store.
 * Replaces all existing chunks for the given source (idempotent).
 */
export async function embedSource(
  provider: ModelProvider,
  sourceId: string,
  sourceType: SourceType,
  workspaceId: string,
  text: string,
  pg: Pool,
  config: EmbedderConfig = DEFAULT_CONFIG,
): Promise<number> {
  const chunks = chunkText(text, config.chunkSize, config.chunkOverlap);
  if (chunks.length === 0) return 0;

  const embeddings: Array<{ chunkIndex: number; chunkText: string; embedding: number[] }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await provider.embed(chunks[i]);
    embeddings.push({
      chunkIndex: i,
      chunkText: chunks[i],
      embedding,
    });
  }

  await upsertChunks(sourceId, sourceType, workspaceId, embeddings, pg);
  return chunks.length;
}
