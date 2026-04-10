/** Contract: contracts/kb/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { KBSnapshot, EntryVersionMap, SnapshotEntry } from './snapshot-types.ts';

// --- Row mapping ---

interface SnapshotRow {
  id: string;
  workspace_id: string;
  purpose: string;
  captured_by: string;
  captured_at: Date;
  entry_versions: EntryVersionMap;
}

function rowToSnapshot(row: SnapshotRow): KBSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    purpose: row.purpose,
    capturedBy: row.captured_by,
    capturedAt: row.captured_at,
    entryVersions: row.entry_versions,
  };
}

export interface KbSnapshotStore {
  createSnapshot(workspaceId: string, purpose: string, capturedBy: string): Promise<KBSnapshot>;
  getSnapshot(workspaceId: string, id: string): Promise<KBSnapshot | null>;
  listSnapshots(workspaceId: string, opts?: { limit?: number; offset?: number }): Promise<KBSnapshot[]>;
  getSnapshotEntries(workspaceId: string, snapshotId: string): Promise<SnapshotEntry[]>;
}

export function createKbSnapshotStore(pool: Pool): KbSnapshotStore {
  /**
   * Capture a snapshot of current published versions of ALL entries in the workspace.
   * Builds the entry_versions map from live data, then inserts an immutable snapshot row.
   */
  async function createSnapshot(
    workspaceId: string,
    purpose: string,
    capturedBy: string,
  ): Promise<KBSnapshot> {
    const id = randomUUID();

    // Capture current published versions atomically
    const entriesResult = await pool.query<{ id: string; version: number }>(
      'SELECT id, version FROM kb_entries WHERE workspace_id = $1',
      [workspaceId],
    );

    const entryVersions: EntryVersionMap = {};
    for (const row of entriesResult.rows) {
      entryVersions[row.id] = row.version;
    }

    const result = await pool.query<SnapshotRow>(
      `INSERT INTO kb_snapshots (id, workspace_id, purpose, captured_by, entry_versions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, workspaceId, purpose, capturedBy, JSON.stringify(entryVersions)],
    );

    return rowToSnapshot(result.rows[0]);
  }

  /** Get a single snapshot by ID, scoped to workspace. */
  async function getSnapshot(workspaceId: string, id: string): Promise<KBSnapshot | null> {
    const result = await pool.query<SnapshotRow>(
      'SELECT * FROM kb_snapshots WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return result.rows[0] ? rowToSnapshot(result.rows[0]) : null;
  }

  /** List snapshots for a workspace, ordered by captured_at DESC. */
  async function listSnapshots(
    workspaceId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<KBSnapshot[]> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const result = await pool.query<SnapshotRow>(
      `SELECT * FROM kb_snapshots
       WHERE workspace_id = $1
       ORDER BY captured_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    );

    return result.rows.map(rowToSnapshot);
  }

  /**
   * Resolve a snapshot: for each entry in entry_versions, fetch that specific
   * version from kb_version_history. Returns the versioned data for each entry.
   */
  async function getSnapshotEntries(
    workspaceId: string,
    snapshotId: string,
  ): Promise<SnapshotEntry[]> {
    const snapshot = await getSnapshot(workspaceId, snapshotId);
    if (!snapshot) return [];

    const entryIds = Object.keys(snapshot.entryVersions);
    if (entryIds.length === 0) return [];

    // Build parameterized query for all (entry_id, version) pairs
    const conditions: string[] = [];
    const params: unknown[] = [workspaceId];
    let idx = 2;

    for (const entryId of entryIds) {
      const version = snapshot.entryVersions[entryId];
      conditions.push(`(vh.entry_id = $${idx} AND vh.version = $${idx + 1})`);
      params.push(entryId, version);
      idx += 2;
    }

    const result = await pool.query<{
      entry_id: string; version: number; title: string;
      metadata: Record<string, unknown>; tags: string[];
    }>(
      `SELECT vh.entry_id, vh.version, vh.title, vh.metadata, vh.tags
       FROM kb_version_history vh
       JOIN kb_entries e ON e.id = vh.entry_id AND e.workspace_id = $1
       WHERE ${conditions.join(' OR ')}
       ORDER BY vh.title ASC`,
      params,
    );

    return result.rows.map((r) => ({
      entryId: r.entry_id,
      version: r.version,
      title: r.title,
      metadata: r.metadata,
      tags: r.tags,
    }));
  }

  return { createSnapshot, getSnapshot, listSnapshots, getSnapshotEntries };
}
