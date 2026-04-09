/** Contract: contracts/kb/rules.md */
import { pool } from '../../storage/internal/pool.ts';
import type { KBEntry } from './types.ts';

interface EntryRow {
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
}

function rowToEntry(row: EntryRow): KBEntry {
  return {
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
  };
}

/**
 * Find all entries that reference a given entry via relationships.
 * Returns entries that have an outgoing relationship targeting the given entryId.
 */
export async function getReverseDependencies(
  workspaceId: string,
  entryId: string,
  relationType?: string,
): Promise<KBEntry[]> {
  const params: unknown[] = [workspaceId, entryId];
  let typeFilter = '';

  if (relationType) {
    typeFilter = 'AND r.relation_type = $3';
    params.push(relationType);
  }

  const sql = `
    SELECT DISTINCT e.*
    FROM kb_entries e
    JOIN kb_relationships r ON r.source_id = e.id
    WHERE e.workspace_id = $1
      AND r.target_id = $2
      ${typeFilter}
    ORDER BY e.updated_at DESC
  `;

  const result = await pool.query<EntryRow>(sql, params);
  return result.rows.map(rowToEntry);
}
