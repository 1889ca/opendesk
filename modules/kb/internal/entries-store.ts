/** Contract: contracts/kb/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { KBEntry, KBQueryFilter, KBVersionRecord } from './types.ts';
import { type CreateEntryInput, type UpdateEntryInput, normalizeTags, getMetadataSchema, CreateEntryInputSchema, UpdateEntryInputSchema } from './schemas.ts';

// --- Row mapping ---

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

export interface KbEntriesStore {
  createEntry(input: CreateEntryInput): Promise<KBEntry>;
  getEntry(workspaceId: string, id: string): Promise<KBEntry | null>;
  updateEntry(workspaceId: string, id: string, input: UpdateEntryInput): Promise<KBEntry | null>;
  deleteEntry(workspaceId: string, id: string): Promise<boolean>;
  listEntries(workspaceId: string, filter?: KBQueryFilter): Promise<KBEntry[]>;
  getVersionHistory(workspaceId: string, entryId: string): Promise<KBVersionRecord[]>;
}

export function createKbEntriesStore(pool: Pool): KbEntriesStore {
  async function recordVersion(entry: KBEntry, changedBy: string): Promise<void> {
    await pool.query(
      `INSERT INTO kb_version_history (id, entry_id, version, title, metadata, tags, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), entry.id, entry.version, entry.title, JSON.stringify(entry.metadata), entry.tags, changedBy],
    );
  }

  async function createEntry(input: CreateEntryInput): Promise<KBEntry> {
    const validated = CreateEntryInputSchema.parse(input);
    const metadataSchema = getMetadataSchema(validated.entryType);
    const parsedMeta = metadataSchema.parse(validated.metadata);
    const tags = normalizeTags(validated.tags);
    const id = randomUUID();

    const result = await pool.query<EntryRow>(
      `INSERT INTO kb_entries (id, workspace_id, entry_type, title, metadata, tags, corpus, jurisdiction, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, validated.workspaceId, validated.entryType, validated.title, JSON.stringify(parsedMeta), tags, validated.corpus ?? 'knowledge', validated.jurisdiction ?? null, validated.createdBy],
    );

    const entry = rowToEntry(result.rows[0]);
    await recordVersion(entry, validated.createdBy);
    return entry;
  }

  async function getEntry(workspaceId: string, id: string): Promise<KBEntry | null> {
    const result = await pool.query<EntryRow>(
      'SELECT * FROM kb_entries WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return result.rows[0] ? rowToEntry(result.rows[0]) : null;
  }

  async function updateEntry(
    workspaceId: string,
    id: string,
    input: UpdateEntryInput,
  ): Promise<KBEntry | null> {
    const validated = UpdateEntryInputSchema.parse(input);
    const existing = await getEntry(workspaceId, id);
    if (!existing) return null;

    if (validated.metadata) {
      const metadataSchema = getMetadataSchema(existing.entryType);
      metadataSchema.parse(validated.metadata);
    }

    const tags = validated.tags ? normalizeTags(validated.tags) : undefined;

    const result = await pool.query<EntryRow>(
      `UPDATE kb_entries SET
         title = COALESCE($3, title),
         metadata = COALESCE($4, metadata),
         tags = COALESCE($5, tags),
         corpus = COALESCE($6, corpus),
         jurisdiction = CASE WHEN $7::boolean THEN $8 ELSE jurisdiction END,
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [
        id, workspaceId,
        validated.title ?? null,
        validated.metadata ? JSON.stringify(validated.metadata) : null,
        tags ?? null,
        validated.corpus ?? null,
        validated.jurisdiction !== undefined,
        validated.jurisdiction ?? null,
      ],
    );

    if (!result.rows[0]) return null;
    const entry = rowToEntry(result.rows[0]);
    await recordVersion(entry, validated.updatedBy);
    return entry;
  }

  async function deleteEntry(workspaceId: string, id: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM kb_entries WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async function listEntries(workspaceId: string, filter: KBQueryFilter = {}): Promise<KBEntry[]> {
    const params: unknown[] = [workspaceId];
    const conditions: string[] = ['workspace_id = $1'];
    let paramIdx = 2;

    if (filter.entryType) {
      conditions.push(`entry_type = $${paramIdx}`);
      params.push(filter.entryType);
      paramIdx++;
    }

    if (filter.tags && filter.tags.length > 0) {
      conditions.push(`tags @> $${paramIdx}`);
      params.push(filter.tags);
      paramIdx++;
    }

    if (filter.corpus) {
      conditions.push(`corpus = $${paramIdx}`);
      params.push(filter.corpus);
      paramIdx++;
    }

    if (filter.jurisdiction) {
      conditions.push(`jurisdiction = $${paramIdx}`);
      params.push(filter.jurisdiction);
      paramIdx++;
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const sql = `SELECT * FROM kb_entries
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await pool.query<EntryRow>(sql, params);
    return result.rows.map(rowToEntry);
  }

  async function getVersionHistory(workspaceId: string, entryId: string): Promise<KBVersionRecord[]> {
    const result = await pool.query<{
      id: string; entry_id: string; version: number; title: string;
      metadata: Record<string, unknown>; tags: string[]; changed_by: string; changed_at: Date;
    }>(
      `SELECT vh.* FROM kb_version_history vh
       JOIN kb_entries e ON e.id = vh.entry_id
       WHERE vh.entry_id = $1 AND e.workspace_id = $2
       ORDER BY vh.version DESC`,
      [entryId, workspaceId],
    );

    return result.rows.map((r) => ({
      id: r.id,
      entryId: r.entry_id,
      version: r.version,
      title: r.title,
      metadata: r.metadata,
      tags: r.tags,
      changedBy: r.changed_by,
      changedAt: r.changed_at,
    }));
  }

  return { createEntry, getEntry, updateEntry, deleteEntry, listEntries, getVersionHistory };
}
