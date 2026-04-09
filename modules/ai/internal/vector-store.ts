/** Contract: contracts/ai/rules.md */
import type { Pool } from 'pg';
import { pool as defaultPool } from '../../storage/internal/pool.ts';
import type { SourceType, SemanticSearchResult } from '../contract.ts';

/** SQL to create the embeddings table with pgvector. */
export const APPLY_EMBEDDINGS_SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('document', 'kb-entry')),
    workspace_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_embeddings_source
    ON embeddings (source_id, source_type);

  CREATE INDEX IF NOT EXISTS idx_embeddings_workspace
    ON embeddings (workspace_id);
`;

/**
 * Replace all chunks for a source with new embeddings.
 * Deletes existing chunks first (idempotent re-embedding).
 */
export async function upsertChunks(
  sourceId: string,
  sourceType: SourceType,
  workspaceId: string,
  chunks: Array<{ chunkIndex: number; chunkText: string; embedding: number[] }>,
  pg: Pool = defaultPool,
): Promise<void> {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Delete existing chunks for this source
    await client.query(
      'DELETE FROM embeddings WHERE source_id = $1 AND source_type = $2',
      [sourceId, sourceType],
    );

    // Insert new chunks
    for (const chunk of chunks) {
      const vectorStr = `[${chunk.embedding.join(',')}]`;
      await client.query(
        `INSERT INTO embeddings (source_id, source_type, workspace_id, chunk_index, chunk_text, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [sourceId, sourceType, workspaceId, chunk.chunkIndex, chunk.chunkText, vectorStr],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Delete all embeddings for a given source. */
export async function deleteEmbeddings(
  sourceId: string,
  sourceType: SourceType,
  pg: Pool = defaultPool,
): Promise<void> {
  await pg.query(
    'DELETE FROM embeddings WHERE source_id = $1 AND source_type = $2',
    [sourceId, sourceType],
  );
}

/**
 * Search for similar chunks using cosine similarity.
 * Optionally filter by source type and workspace.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  workspaceId: string,
  options: {
    sourceTypes?: SourceType[];
    limit?: number;
    excludeSourceIds?: string[];
  } = {},
  pg: Pool = defaultPool,
): Promise<SemanticSearchResult[]> {
  const { sourceTypes, limit = 10, excludeSourceIds } = options;
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const conditions = ['workspace_id = $2'];
  const params: unknown[] = [vectorStr, workspaceId];
  let idx = 3;

  if (sourceTypes && sourceTypes.length > 0) {
    conditions.push(`source_type = ANY($${idx++})`);
    params.push(sourceTypes);
  }

  if (excludeSourceIds && excludeSourceIds.length > 0) {
    conditions.push(`source_id != ALL($${idx++})`);
    params.push(excludeSourceIds);
  }

  const sql = `
    SELECT source_id, source_type, chunk_text,
           1 - (embedding <=> $1::vector) AS similarity
    FROM embeddings
    WHERE ${conditions.join(' AND ')}
    ORDER BY embedding <=> $1::vector
    LIMIT ${limit}
  `;

  const result = await pg.query<{
    source_id: string;
    source_type: string;
    chunk_text: string;
    similarity: number;
  }>(sql, params);

  return result.rows.map((row) => ({
    sourceId: row.source_id,
    sourceType: row.source_type as SourceType,
    chunkText: row.chunk_text,
    similarity: Number(row.similarity),
    metadata: {},
  }));
}
