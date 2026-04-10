/** Contract: contracts/references/rules.md */
import type { Pool } from 'pg';

export interface ReferenceRow {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  authors: unknown[];
  issued_date: string | null;
  container_title: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  isbn: string | null;
  abstract: string | null;
  publisher: string | null;
  language: string;
  custom_fields: Record<string, unknown>;
  tags: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReferenceUpdates {
  title?: string;
  authors?: unknown[];
  type?: string;
  issued_date?: string | null;
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url?: string | null;
  isbn?: string | null;
  abstract?: string | null;
  publisher?: string | null;
  language?: string;
  custom_fields?: Record<string, unknown>;
  tags?: string[];
}

export interface ReferencesStore {
  createReference(
    id: string,
    workspaceId: string,
    createdBy: string,
    fields: ReferenceUpdates & { title: string },
  ): Promise<ReferenceRow>;
  getReference(id: string): Promise<ReferenceRow | null>;
  listReferences(workspaceId: string): Promise<ReferenceRow[]>;
  updateReference(id: string, updates: ReferenceUpdates): Promise<ReferenceRow | null>;
  deleteReference(id: string): Promise<boolean>;
  findByDOI(workspaceId: string, doi: string): Promise<ReferenceRow | null>;
}

export function createReferencesStore(pool: Pool): ReferencesStore {
  async function createReference(
    id: string,
    workspaceId: string,
    createdBy: string,
    fields: ReferenceUpdates & { title: string },
  ): Promise<ReferenceRow> {
    const result = await pool.query<ReferenceRow>(
      `INSERT INTO reference_entries (id, workspace_id, type, title, authors, issued_date,
         container_title, volume, issue, pages, doi, url, isbn, abstract, publisher,
         language, custom_fields, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        id, workspaceId, fields.type ?? 'article-journal', fields.title,
        JSON.stringify(fields.authors ?? []), fields.issued_date ?? null,
        fields.container_title ?? null, fields.volume ?? null,
        fields.issue ?? null, fields.pages ?? null, fields.doi ?? null,
        fields.url ?? null, fields.isbn ?? null, fields.abstract ?? null,
        fields.publisher ?? null, fields.language ?? 'en',
        JSON.stringify(fields.custom_fields ?? {}), fields.tags ?? [], createdBy,
      ],
    );
    return result.rows[0];
  }

  async function getReference(id: string): Promise<ReferenceRow | null> {
    const result = await pool.query<ReferenceRow>(
      'SELECT * FROM reference_entries WHERE id = $1',
      [id],
    );
    return result.rows[0] || null;
  }

  async function listReferences(workspaceId: string): Promise<ReferenceRow[]> {
    const result = await pool.query<ReferenceRow>(
      'SELECT * FROM reference_entries WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    );
    return result.rows;
  }

  async function updateReference(
    id: string,
    updates: ReferenceUpdates,
  ): Promise<ReferenceRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, (v: unknown) => unknown> = {
      title: (v) => v,
      type: (v) => v,
      authors: (v) => JSON.stringify(v),
      issued_date: (v) => v,
      container_title: (v) => v,
      volume: (v) => v,
      issue: (v) => v,
      pages: (v) => v,
      doi: (v) => v,
      url: (v) => v,
      isbn: (v) => v,
      abstract: (v) => v,
      publisher: (v) => v,
      language: (v) => v,
      custom_fields: (v) => JSON.stringify(v),
      tags: (v) => v,
    };

    for (const [key, transform] of Object.entries(fieldMap)) {
      const val = (updates as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(transform(val));
      }
    }

    if (sets.length === 0) return getReference(id);

    sets.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query<ReferenceRow>(
      `UPDATE reference_entries SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] || null;
  }

  async function deleteReference(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM reference_entries WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async function findByDOI(
    workspaceId: string,
    doi: string,
  ): Promise<ReferenceRow | null> {
    const result = await pool.query<ReferenceRow>(
      'SELECT * FROM reference_entries WHERE workspace_id = $1 AND doi = $2',
      [workspaceId, doi],
    );
    return result.rows[0] || null;
  }

  return { createReference, getReference, listReferences, updateReference, deleteReference, findByDOI };
}
