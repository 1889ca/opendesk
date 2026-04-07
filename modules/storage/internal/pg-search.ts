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
 * Full-text search filtered by permission.
 * When allowedDocumentIds is provided, only documents in that list are returned.
 * When omitted (dev mode), all matching documents are returned.
 */
export async function searchDocuments(
  query: string,
  allowedDocumentIds?: string[],
): Promise<SearchResult[]> {
  if (allowedDocumentIds && allowedDocumentIds.length === 0) {
    return [];
  }

  const useFilter = allowedDocumentIds !== undefined;
  const sql = `SELECT
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
       ${useFilter ? 'AND id = ANY($2)' : ''}
     ORDER BY rank DESC, updated_at DESC
     LIMIT 50`;

  const params = useFilter ? [query, allowedDocumentIds] : [query];
  const result = await pool.query<SearchResult>(sql, params);
  return result.rows;
}
