/** Contract: contracts/storage/rules.md */
import type { Pool } from 'pg';
import { pool as defaultPool } from './pool.ts';

export type ContentType = 'document' | 'spreadsheet' | 'presentation';

export interface GlobalSearchResult {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  content_type: ContentType;
  updated_at: Date;
}

/** Map database document_type values to our ContentType enum. */
const TYPE_MAP: Record<string, ContentType> = {
  text: 'document',
  spreadsheet: 'spreadsheet',
  presentation: 'presentation',
};

/**
 * Cross-type full-text search across all document types.
 * Queries the documents table (which contains text, spreadsheet, and presentation entries)
 * using the existing tsvector column on title.
 *
 * When allowedDocumentIds is provided, only documents in that list are returned.
 * When omitted (dev mode), all matching documents are returned.
 *
 * Results are grouped and returned with their content_type for UI grouping.
 */
export async function globalSearch(
  query: string,
  allowedDocumentIds?: string[],
  pool: Pool = defaultPool,
): Promise<GlobalSearchResult[]> {
  if (allowedDocumentIds && allowedDocumentIds.length === 0) {
    return [];
  }

  const useFilter = allowedDocumentIds !== undefined;
  const sql = `SELECT
       id,
       title,
       document_type,
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
  const result = await pool.query<{
    id: string;
    title: string;
    document_type: string;
    snippet: string;
    rank: number;
    updated_at: Date;
  }>(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    rank: row.rank,
    content_type: TYPE_MAP[row.document_type] ?? 'document',
    updated_at: row.updated_at,
  }));
}
