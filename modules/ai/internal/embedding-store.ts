/** Contract: contracts/ai/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { SemanticSearchResult } from '../contract.ts';

/**
 * Upsert embedding chunks for a document.
 * Replaces all existing chunks for the document.
 */
export async function upsertEmbeddings(
  pool: Pool,
  documentId: string,
  chunks: Array<{ index: number; content: string; embedding: number[] }>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing embeddings for this document
    await client.query(
      'DELETE FROM document_embeddings WHERE document_id = $1',
      [documentId],
    );

    // Insert new chunks
    for (const chunk of chunks) {
      const vectorStr = `[${chunk.embedding.join(',')}]`;
      await client.query(
        `INSERT INTO document_embeddings (id, document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [randomUUID(), documentId, chunk.index, chunk.content, vectorStr],
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

/**
 * Semantic search using cosine similarity.
 * Returns top-K results filtered by allowed document IDs.
 */
export async function searchByVector(
  pool: Pool,
  queryEmbedding: number[],
  allowedDocumentIds: string[],
  limit = 10,
): Promise<SemanticSearchResult[]> {
  if (allowedDocumentIds.length === 0) return [];

  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const result = await pool.query<{
    document_id: string;
    title: string;
    content: string;
    similarity: number;
  }>(
    `SELECT
       e.document_id,
       d.title,
       e.content,
       1 - (e.embedding <=> $1::vector) AS similarity
     FROM document_embeddings e
     JOIN documents d ON d.id = e.document_id
     WHERE e.document_id = ANY($2)
       AND e.embedding IS NOT NULL
     ORDER BY e.embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, allowedDocumentIds, limit],
  );

  return result.rows.map((r) => ({
    documentId: r.document_id,
    title: r.title || 'Untitled',
    chunkContent: r.content,
    similarity: Math.round(r.similarity * 1000) / 1000,
  }));
}

/** Delete all embeddings for a document. */
export async function deleteEmbeddings(
  pool: Pool,
  documentId: string,
): Promise<void> {
  await pool.query(
    'DELETE FROM document_embeddings WHERE document_id = $1',
    [documentId],
  );
}

/** Count embedded chunks for a document. */
export async function countEmbeddings(
  pool: Pool,
  documentId: string,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM document_embeddings WHERE document_id = $1',
    [documentId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
