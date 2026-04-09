/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';

export type DocumentType = 'text' | 'spreadsheet' | 'presentation';

export interface DocumentRow {
  id: string;
  title: string;
  document_type: DocumentType;
  yjs_state: Buffer | null;
  folder_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export type SortField = 'updated_at' | 'created_at' | 'title';
export type SortDir = 'asc' | 'desc';

export interface ListDocumentsOptions {
  folderId?: string | null;
  type?: string | null;
  sort?: SortField;
  sortDir?: SortDir;
  limit?: number;
  offset?: number;
}

export interface ListDocumentsResult {
  rows: DocumentRow[];
  total: number;
}

export async function listDocuments(
  opts: ListDocumentsOptions = {},
): Promise<ListDocumentsResult> {
  const {
    folderId,
    type,
    sort = 'updated_at',
    sortDir = 'desc',
    limit = 20,
    offset = 0,
  } = opts;

  // Allowlist sort field and direction to prevent SQL injection
  const allowedSorts: SortField[] = ['updated_at', 'created_at', 'title'];
  const safeSort: SortField = allowedSorts.includes(sort) ? sort : 'updated_at';
  const safeDir = sortDir === 'asc' ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (folderId) {
    conditions.push(`folder_id = $${values.length + 1}`);
    values.push(folderId);
  } else {
    conditions.push('folder_id IS NULL');
  }

  if (type) {
    conditions.push(`document_type = $${values.length + 1}`);
    values.push(type);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM documents ${where}`,
    values,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const limitVal = values.length + 1;
  const offsetVal = values.length + 2;
  const dataResult = await pool.query<DocumentRow>(
    `SELECT id, title, document_type, folder_id, created_at, updated_at FROM documents ${where} ORDER BY ${safeSort} ${safeDir} LIMIT $${limitVal} OFFSET $${offsetVal}`,
    [...values, limit, offset],
  );

  return { rows: dataResult.rows, total };
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const result = await pool.query<DocumentRow>(
    'SELECT * FROM documents WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createDocument(
  id: string,
  title: string,
  documentType: DocumentType = 'text',
): Promise<DocumentRow> {
  const result = await pool.query<DocumentRow>(
    'INSERT INTO documents (id, title, document_type) VALUES ($1, $2, $3) RETURNING *',
    [id, title, documentType]
  );
  return result.rows[0];
}

export async function saveYjsState(id: string, state: Uint8Array): Promise<void> {
  await pool.query(
    `INSERT INTO documents (id, title, yjs_state, updated_at)
     VALUES ($1, 'Untitled', $2, NOW())
     ON CONFLICT (id) DO UPDATE SET yjs_state = $2, updated_at = NOW()`,
    [id, Buffer.from(state)]
  );
}

export async function loadYjsState(id: string): Promise<Uint8Array | null> {
  const result = await pool.query<{ yjs_state: Buffer | null }>(
    'SELECT yjs_state FROM documents WHERE id = $1',
    [id]
  );
  const row = result.rows[0];
  if (!row?.yjs_state) return null;
  return new Uint8Array(row.yjs_state);
}

export async function deleteDocument(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateDocumentTitle(id: string, title: string): Promise<void> {
  await pool.query(
    'UPDATE documents SET title = $1, updated_at = NOW() WHERE id = $2',
    [title, id]
  );
}
