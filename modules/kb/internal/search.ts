/** Contract: contracts/kb/rules.md */
import type { Pool } from 'pg';
import type { KBEntry, KBSearchResult } from './types.ts';

interface SearchRow {
  id: string;
  workspace_id: string;
  entry_type: string;
  title: string;
  metadata: Record<string, unknown>;
  tags: string[];
  version: number;
  corpus: string;
  jurisdiction: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  rank: number;
  snippet: string;
}

function rowToSearchResult(row: SearchRow): KBSearchResult {
  return {
    entry: {
      id: row.id,
      workspaceId: row.workspace_id,
      entryType: row.entry_type as KBEntry['entryType'],
      title: row.title,
      metadata: row.metadata,
      tags: row.tags,
      version: row.version,
      corpus: (row.corpus ?? 'knowledge') as KBEntry['corpus'],
      jurisdiction: row.jurisdiction,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    rank: row.rank,
    snippet: row.snippet,
  };
}

export interface KbSearchStore {
  searchEntries(
    workspaceId: string,
    query: string,
    options?: {
      entryType?: string;
      corpus?: string;
      jurisdiction?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<KBSearchResult[]>;
}

export function createKbSearchStore(pool: Pool): KbSearchStore {
  /**
   * Full-text search across KB entries within a workspace.
   * Searches title and metadata using PostgreSQL tsvector.
   */
  async function searchEntries(
    workspaceId: string,
    query: string,
    options: { entryType?: string; corpus?: string; jurisdiction?: string; limit?: number; offset?: number } = {},
  ): Promise<KBSearchResult[]> {
    if (!query.trim()) return [];

    const params: unknown[] = [workspaceId, query];
    const conditions: string[] = [
      'workspace_id = $1',
      "search_vector @@ plainto_tsquery('english', $2)",
    ];
    let paramIdx = 3;

    if (options.entryType) {
      conditions.push(`entry_type = $${paramIdx}`);
      params.push(options.entryType);
      paramIdx++;
    }

    if (options.corpus) {
      conditions.push(`corpus = $${paramIdx}`);
      params.push(options.corpus);
      paramIdx++;
    }

    if (options.jurisdiction) {
      conditions.push(`jurisdiction = $${paramIdx}`);
      params.push(options.jurisdiction);
      paramIdx++;
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const sql = `SELECT *,
      ts_rank(search_vector, plainto_tsquery('english', $2)) AS rank,
      ts_headline(
        'english',
        coalesce(title, '') || ' ' || coalesce(metadata::text, ''),
        plainto_tsquery('english', $2),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
      ) AS snippet
    FROM kb_entries
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank DESC, updated_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

    params.push(limit, offset);

    const result = await pool.query<SearchRow>(sql, params);
    return result.rows.map(rowToSearchResult);
  }

  return { searchEntries };
}
