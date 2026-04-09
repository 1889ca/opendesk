/** Contract: contracts/kb/rules.md */
// #134 follow-up: this should become a factory that takes pool via DI.
// For now, importing through the storage internal pool keeps the
// public storage contract clean.
import { pool } from '../../storage/internal/pool.ts';
import type { KbEntryStatus } from '../contract.ts';

export interface KbEntryRow {
  id: string;
  workspace_id: string;
  title: string;
  body: string;
  status: KbEntryStatus;
  version: number;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface KbEntryFields {
  title?: string;
  body?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Create a new KB entry in draft status at version 1.
 * Also creates the initial version snapshot.
 */
export async function createEntry(
  id: string,
  workspaceId: string,
  createdBy: string,
  fields: KbEntryFields & { title: string },
): Promise<KbEntryRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query<KbEntryRow>(
      `INSERT INTO kb_entries (id, workspace_id, title, body, status, version, tags, metadata, created_by)
       VALUES ($1, $2, $3, $4, 'draft', 1, $5, $6, $7)
       RETURNING *`,
      [
        id, workspaceId, fields.title, fields.body ?? '',
        fields.tags ?? [], JSON.stringify(fields.metadata ?? {}), createdBy,
      ],
    );

    const entry = result.rows[0];

    // Create initial version snapshot
    await client.query(
      `INSERT INTO kb_entry_versions (id, entry_id, version, title, body, tags, metadata, created_by)
       VALUES (gen_random_uuid(), $1, 1, $2, $3, $4, $5, $6)`,
      [id, entry.title, entry.body, entry.tags, JSON.stringify(entry.metadata), createdBy],
    );

    await client.query('COMMIT');
    return entry;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get a single KB entry by ID.
 */
export async function getEntry(id: string): Promise<KbEntryRow | null> {
  const result = await pool.query<KbEntryRow>(
    'SELECT * FROM kb_entries WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

/**
 * List KB entries for a workspace, with optional status filter.
 */
export async function listEntries(
  workspaceId: string,
  statusFilter?: KbEntryStatus,
): Promise<KbEntryRow[]> {
  if (statusFilter) {
    const result = await pool.query<KbEntryRow>(
      `SELECT * FROM kb_entries WHERE workspace_id = $1 AND status = $2
       ORDER BY updated_at DESC`,
      [workspaceId, statusFilter],
    );
    return result.rows;
  }
  const result = await pool.query<KbEntryRow>(
    'SELECT * FROM kb_entries WHERE workspace_id = $1 ORDER BY updated_at DESC',
    [workspaceId],
  );
  return result.rows;
}

/**
 * List only published entries (for RAG, citations, federation).
 */
export async function listPublishedEntries(
  workspaceId: string,
): Promise<KbEntryRow[]> {
  return listEntries(workspaceId, 'published');
}

/**
 * Update an entry's content fields and bump the version.
 * Creates a new immutable version snapshot.
 */
export async function updateEntry(
  id: string,
  updatedBy: string,
  updates: KbEntryFields,
): Promise<KbEntryRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query<KbEntryRow>(
      'SELECT * FROM kb_entries WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const entry = current.rows[0];
    const newVersion = entry.version + 1;
    const newTitle = updates.title ?? entry.title;
    const newBody = updates.body ?? entry.body;
    const newTags = updates.tags ?? entry.tags;
    const newMeta = updates.metadata ?? entry.metadata;

    const result = await client.query<KbEntryRow>(
      `UPDATE kb_entries
       SET title = $1, body = $2, tags = $3, metadata = $4,
           version = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [newTitle, newBody, newTags, JSON.stringify(newMeta), newVersion, id],
    );

    // Create immutable version snapshot
    await client.query(
      `INSERT INTO kb_entry_versions (id, entry_id, version, title, body, tags, metadata, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [id, newVersion, newTitle, newBody, newTags, JSON.stringify(newMeta), updatedBy],
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transition an entry's status. Does NOT validate the transition --
 * caller must use validateTransition() from lifecycle.ts first.
 */
export async function transitionStatus(
  id: string,
  newStatus: KbEntryStatus,
): Promise<KbEntryRow | null> {
  const result = await pool.query<KbEntryRow>(
    `UPDATE kb_entries SET status = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [newStatus, id],
  );
  return result.rows[0] || null;
}

/**
 * Delete a KB entry and all its version snapshots (cascaded by FK).
 */
export async function deleteEntry(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM kb_entries WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
