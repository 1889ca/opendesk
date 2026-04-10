/** Contract: contracts/kb/rules.md */
import type { Pool } from 'pg';

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

export interface KbVersionStore {
  getVersion(entryId: string, version: number): Promise<KbVersionRow | null>;
  getLatestVersion(entryId: string): Promise<KbVersionRow | null>;
  listVersions(entryId: string): Promise<KbVersionRow[]>;
}

export function createKbVersionStore(pool: Pool): KbVersionStore {
  /** Get a specific version snapshot for a KB entry. */
  async function getVersion(
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

  /** Get the latest (highest-numbered) version snapshot for a KB entry. */
  async function getLatestVersion(entryId: string): Promise<KbVersionRow | null> {
    const result = await pool.query<KbVersionRow>(
      `SELECT * FROM kb_entry_versions
       WHERE entry_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [entryId],
    );
    return result.rows[0] || null;
  }

  /** List all version snapshots for a KB entry, most recent first. */
  async function listVersions(entryId: string): Promise<KbVersionRow[]> {
    const result = await pool.query<KbVersionRow>(
      `SELECT * FROM kb_entry_versions
       WHERE entry_id = $1
       ORDER BY version DESC`,
      [entryId],
    );
    return result.rows;
  }

  return { getVersion, getLatestVersion, listVersions };
}
