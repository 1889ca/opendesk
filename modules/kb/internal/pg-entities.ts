/** Contract: contracts/kb/rules.md */
// #134 follow-up: factory + DI. See pg-entries.ts.
import { pool } from '../../storage/internal/pool.ts';
import type { EntitySubtype } from '../contract.ts';

export interface EntityRow {
  id: string;
  workspace_id: string;
  subtype: string;
  name: string;
  content: Record<string, unknown>;
  tags: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface EntityUpdates {
  name?: string;
  subtype?: string;
  content?: Record<string, unknown>;
  tags?: string[];
}

export async function createEntity(
  id: string,
  workspaceId: string,
  createdBy: string,
  fields: EntityUpdates & { name: string; subtype: string },
): Promise<EntityRow> {
  const result = await pool.query<EntityRow>(
    `INSERT INTO kb_entities (id, workspace_id, subtype, name, content, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      workspaceId,
      fields.subtype,
      fields.name,
      JSON.stringify(fields.content ?? {}),
      fields.tags ?? [],
      createdBy,
    ],
  );
  return result.rows[0];
}

export async function getEntity(id: string): Promise<EntityRow | null> {
  const result = await pool.query<EntityRow>(
    'SELECT * FROM kb_entities WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

export async function listEntities(
  workspaceId: string,
  opts?: { subtype?: EntitySubtype; query?: string; limit?: number },
): Promise<EntityRow[]> {
  const conditions = ['workspace_id = $1'];
  const values: unknown[] = [workspaceId];
  let idx = 2;

  if (opts?.subtype) {
    conditions.push(`subtype = $${idx++}`);
    values.push(opts.subtype);
  }

  if (opts?.query) {
    conditions.push(`name ILIKE $${idx++}`);
    values.push(`%${opts.query}%`);
  }

  const limit = opts?.limit ?? 100;
  const sql = `SELECT * FROM kb_entities WHERE ${conditions.join(' AND ')}
    ORDER BY name ASC LIMIT ${limit}`;

  const result = await pool.query<EntityRow>(sql, values);
  return result.rows;
}

export async function updateEntity(
  id: string,
  updates: EntityUpdates,
): Promise<EntityRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, (v: unknown) => unknown> = {
    name: (v) => v,
    subtype: (v) => v,
    content: (v) => JSON.stringify(v),
    tags: (v) => v,
  };

  for (const [key, transform] of Object.entries(fieldMap)) {
    const val = (updates as Record<string, unknown>)[key];
    if (val !== undefined) {
      sets.push(`${key} = $${idx++}`);
      values.push(transform(val));
    }
  }

  if (sets.length === 0) return getEntity(id);

  sets.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query<EntityRow>(
    `UPDATE kb_entities SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteEntity(id: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM kb_entities WHERE id = $1',
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function searchEntities(
  workspaceId: string,
  query: string,
  limit = 10,
): Promise<EntityRow[]> {
  const result = await pool.query<EntityRow>(
    `SELECT * FROM kb_entities
     WHERE workspace_id = $1 AND name ILIKE $2
     ORDER BY name ASC LIMIT $3`,
    [workspaceId, `%${query}%`, limit],
  );
  return result.rows;
}
