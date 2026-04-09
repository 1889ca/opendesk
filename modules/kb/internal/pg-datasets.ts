/** Contract: contracts/kb/rules.md */
import { randomUUID } from 'node:crypto';
import { pool } from '../../storage/internal/pool.ts';

export interface DatasetRow {
  id: string;
  entry_id: string;
  row_index: number;
  data: Record<string, unknown>;
  created_at: Date;
}

export interface DatasetRowInput {
  data: Record<string, unknown>;
}

/** Insert rows into a dataset entry starting at the given index. */
export async function insertRows(
  entryId: string,
  rows: DatasetRowInput[],
  startIndex = 0,
): Promise<DatasetRow[]> {
  if (rows.length === 0) return [];

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (let i = 0; i < rows.length; i++) {
    const id = randomUUID();
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(id, entryId, startIndex + i, JSON.stringify(rows[i].data));
  }

  const result = await pool.query<DatasetRow>(
    `INSERT INTO kb_dataset_rows (id, entry_id, row_index, data)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values,
  );
  return result.rows;
}

/** Get all rows for a dataset entry, ordered by row_index. */
export async function getRows(
  entryId: string,
  opts?: { limit?: number; offset?: number },
): Promise<DatasetRow[]> {
  const limit = opts?.limit ?? 1000;
  const offset = opts?.offset ?? 0;
  const result = await pool.query<DatasetRow>(
    `SELECT * FROM kb_dataset_rows
     WHERE entry_id = $1
     ORDER BY row_index ASC
     LIMIT $2 OFFSET $3`,
    [entryId, limit, offset],
  );
  return result.rows;
}

/** Get the total row count for a dataset entry. */
export async function getRowCount(entryId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM kb_dataset_rows WHERE entry_id = $1',
    [entryId],
  );
  return parseInt(result.rows[0].count, 10);
}

/** Update a single row's data by row ID. */
export async function updateRow(
  rowId: string,
  entryId: string,
  data: Record<string, unknown>,
): Promise<DatasetRow | null> {
  const result = await pool.query<DatasetRow>(
    `UPDATE kb_dataset_rows SET data = $1
     WHERE id = $2 AND entry_id = $3
     RETURNING *`,
    [JSON.stringify(data), rowId, entryId],
  );
  return result.rows[0] || null;
}

/** Delete a single row by row ID. */
export async function deleteRow(rowId: string, entryId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM kb_dataset_rows WHERE id = $1 AND entry_id = $2',
    [rowId, entryId],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Delete all rows for a dataset entry. */
export async function clearRows(entryId: string): Promise<number> {
  const result = await pool.query(
    'DELETE FROM kb_dataset_rows WHERE entry_id = $1',
    [entryId],
  );
  return result.rowCount ?? 0;
}

/** Replace all rows for a dataset entry (atomic swap). */
export async function replaceRows(
  entryId: string,
  rows: DatasetRowInput[],
): Promise<DatasetRow[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM kb_dataset_rows WHERE entry_id = $1', [entryId]);

    if (rows.length === 0) {
      await client.query('COMMIT');
      return [];
    }

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (let i = 0; i < rows.length; i++) {
      const id = randomUUID();
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(id, entryId, i, JSON.stringify(rows[i].data));
    }

    const result = await client.query<DatasetRow>(
      `INSERT INTO kb_dataset_rows (id, entry_id, row_index, data)
       VALUES ${placeholders.join(', ')}
       RETURNING *`,
      values,
    );

    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
