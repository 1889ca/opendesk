/** Contract: contracts/kb/rules.md */
// #134 follow-up: factory + DI. See pg-entries.ts.
import { pool } from '../../storage/internal/pool.ts';

export interface KbVersionRow {
  id: string;
  entry_id: string;
  version: number;
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: Date;
}

/**
 * Get a specific version snapshot for a KB entry.
 */
export async function getVersion(
  entryId: string,
  version: number,
): Promise<KbVersionRow | null> {
  const result = await pool.query<KbVersionRow>(
    `SELECT * FROM kb_entry_versions
     WHERE entry_id = $1 AND version = $2`,
    [entryId, version],
  );
  return result.rows[0] || null;
}

/**
 * Get the latest (highest-numbered) version snapshot for a KB entry.
 */
export async function getLatestVersion(
  entryId: string,
): Promise<KbVersionRow | null> {
  const result = await pool.query<KbVersionRow>(
    `SELECT * FROM kb_entry_versions
     WHERE entry_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [entryId],
  );
  return result.rows[0] || null;
}

/**
 * List all version snapshots for a KB entry, most recent first.
 */
export async function listVersions(
  entryId: string,
): Promise<KbVersionRow[]> {
  const result = await pool.query<KbVersionRow>(
    `SELECT * FROM kb_entry_versions
     WHERE entry_id = $1
     ORDER BY version DESC`,
    [entryId],
  );
  return result.rows;
}
