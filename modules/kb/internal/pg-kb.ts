/** Contract: contracts/kb/rules.md */
import type { Pool } from 'pg';
import { pool as defaultPool } from '../../storage/internal/pool.ts';
import { STATUS_TRANSITIONS, type KbEntryStatus } from '../contract.ts';

type KbLifecycle = KbEntryStatus;
const VALID_LIFECYCLE_TRANSITIONS = STATUS_TRANSITIONS;

/** Local entry shape for the pg-kb store (lifecycle-aware). */
interface KbEntry {
  id: string;
  workspaceId: string;
  entryType: string;
  corpus: string;
  lifecycle: KbLifecycle;
  title: string;
  tags: string[];
  content: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface KbEntryCreateInput {
  entryType: string;
  corpus: string;
  title: string;
  tags: string[];
  content: Record<string, unknown>;
}

interface KbEntryUpdateInput {
  title?: string;
  tags?: string[];
  content?: Record<string, unknown>;
}

/** Create a new KB entry in draft lifecycle state. */
export async function createEntry(
  workspaceId: string,
  entryId: string,
  createdBy: string,
  input: KbEntryCreateInput,
  pg: Pool = defaultPool,
): Promise<KbEntry> {
  const now = new Date().toISOString();
  const result = await pg.query<Record<string, unknown>>(
    `INSERT INTO kb_entries (id, workspace_id, entry_type, corpus, lifecycle, title, tags, content, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [
      entryId,
      workspaceId,
      input.entryType,
      input.corpus,
      input.title,
      JSON.stringify(input.tags),
      JSON.stringify(input.content),
      createdBy,
      now,
    ],
  );
  return rowToEntry(result.rows[0]);
}

/** Get a KB entry by ID, scoped to workspace. */
export async function getEntry(
  workspaceId: string,
  entryId: string,
  pg: Pool = defaultPool,
): Promise<KbEntry | null> {
  const result = await pg.query(
    `SELECT * FROM kb_entries WHERE id = $1 AND workspace_id = $2`,
    [entryId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToEntry(result.rows[0]);
}

/** List KB entries for a workspace, optionally filtered. */
export async function listEntries(
  workspaceId: string,
  filters?: { entryType?: string; corpus?: string; lifecycle?: string },
  pg: Pool = defaultPool,
): Promise<KbEntry[]> {
  const conditions = ['workspace_id = $1'];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (filters?.entryType) {
    conditions.push(`entry_type = $${idx++}`);
    params.push(filters.entryType);
  }
  if (filters?.corpus) {
    conditions.push(`corpus = $${idx++}`);
    params.push(filters.corpus);
  }
  if (filters?.lifecycle) {
    conditions.push(`lifecycle = $${idx++}`);
    params.push(filters.lifecycle);
  }

  const sql = `SELECT * FROM kb_entries WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`;
  const result = await pg.query(sql, params);
  return result.rows.map(rowToEntry);
}

/** Update a KB entry. Cannot change entryType or corpus. */
export async function updateEntry(
  workspaceId: string,
  entryId: string,
  input: KbEntryUpdateInput,
  pg: Pool = defaultPool,
): Promise<KbEntry | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  let idx = 1;

  if (input.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(input.title);
  }
  if (input.tags !== undefined) {
    sets.push(`tags = $${idx++}`);
    params.push(JSON.stringify(input.tags));
  }
  if (input.content !== undefined) {
    sets.push(`content = content || $${idx++}::jsonb`);
    params.push(JSON.stringify(input.content));
  }

  params.push(entryId, workspaceId);
  const sql = `UPDATE kb_entries SET ${sets.join(', ')}
    WHERE id = $${idx++} AND workspace_id = $${idx}
    RETURNING *`;

  const result = await pg.query(sql, params);
  if (result.rows.length === 0) return null;
  return rowToEntry(result.rows[0]);
}

/** Transition lifecycle state. Validates allowed transitions. */
export async function transitionLifecycle(
  workspaceId: string,
  entryId: string,
  targetLifecycle: KbLifecycle,
  pg: Pool = defaultPool,
): Promise<KbEntry | null> {
  const entry = await getEntry(workspaceId, entryId, pg);
  if (!entry) return null;

  const allowed = VALID_LIFECYCLE_TRANSITIONS[entry.lifecycle];
  if (!allowed.includes(targetLifecycle)) {
    throw new Error(
      `Invalid lifecycle transition: ${entry.lifecycle} -> ${targetLifecycle}`,
    );
  }

  const result = await pg.query(
    `UPDATE kb_entries SET lifecycle = $1, updated_at = NOW()
     WHERE id = $2 AND workspace_id = $3 RETURNING *`,
    [targetLifecycle, entryId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToEntry(result.rows[0]);
}

/** Delete a KB entry. */
export async function deleteEntry(
  workspaceId: string,
  entryId: string,
  pg: Pool = defaultPool,
): Promise<boolean> {
  const result = await pg.query(
    `DELETE FROM kb_entries WHERE id = $1 AND workspace_id = $2`,
    [entryId, workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Row mapping ---

function rowToEntry(row: Record<string, unknown>): KbEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    entryType: String(row.entry_type) as KbEntry['entryType'],
    corpus: String(row.corpus) as KbEntry['corpus'],
    lifecycle: String(row.lifecycle) as KbEntry['lifecycle'],
    title: String(row.title),
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(String(row.tags || '[]')),
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  } as KbEntry;
}
