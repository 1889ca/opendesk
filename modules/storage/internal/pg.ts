/** Contract: contracts/storage/rules.md */
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5433', 10),
  database: process.env.PG_DATABASE || 'opendesk',
  user: process.env.PG_USER || 'opendesk',
  password: process.env.PG_PASSWORD || 'opendesk_dev',
  max: 10,
});

export type DocumentType = 'text' | 'spreadsheet' | 'presentation';

export interface DocumentRow {
  id: string;
  title: string;
  document_type: DocumentType;
  yjs_state: Buffer | null;
  created_at: Date;
  updated_at: Date;
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const result = await pool.query<DocumentRow>(
    'SELECT id, title, document_type, created_at, updated_at FROM documents ORDER BY updated_at DESC'
  );
  return result.rows;
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

export { pool };
