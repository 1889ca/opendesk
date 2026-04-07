/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  updated_at: Date;
}

/**
 * SQL to add a tsvector column to documents and a GIN index for full-text search.
 * The column is generated from the title using English stemming.
 * Safe to run multiple times (IF NOT EXISTS / OR REPLACE).
 */
export const APPLY_SEARCH_SCHEMA = `
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'documents' AND column_name = 'search_vector'
    ) THEN
      ALTER TABLE documents ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_documents_search
    ON documents USING GIN (search_vector);
`;

/**
 * Full-text search across all documents.
 * Uses plainto_tsquery for safe user input handling (no special syntax needed).
 * Returns results ranked by relevance with highlighted snippets.
 */
export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const result = await pool.query<SearchResult>(
    `SELECT
       id,
       title,
       ts_headline(
         'english',
         coalesce(title, ''),
         plainto_tsquery('english', $1),
         'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
       ) AS snippet,
       ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank,
       updated_at
     FROM documents
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC, updated_at DESC
     LIMIT 50`,
    [query],
  );
  return result.rows;
}
