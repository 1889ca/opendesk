/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  content: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateUpdates {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
}

export async function createTemplate(
  id: string,
  name: string,
  description: string,
  content: Record<string, unknown>,
): Promise<TemplateRow> {
  const result = await pool.query<TemplateRow>(
    `INSERT INTO templates (id, name, description, content)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, name, description, JSON.stringify(content)],
  );
  return result.rows[0];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const result = await pool.query<TemplateRow>(
    'SELECT * FROM templates WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const result = await pool.query<TemplateRow>(
    'SELECT * FROM templates ORDER BY created_at ASC',
  );
  return result.rows;
}

export async function updateTemplate(
  id: string,
  updates: TemplateUpdates,
): Promise<TemplateRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    sets.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.content !== undefined) {
    sets.push(`content = $${paramIndex++}`);
    values.push(JSON.stringify(updates.content));
  }

  if (sets.length === 0) return getTemplate(id);

  sets.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query<TemplateRow>(
    `UPDATE templates SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM templates WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
