/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';

export interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: Date;
}

export const CREATE_FOLDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
`;

export async function createFolder(
  id: string,
  name: string,
  parentId?: string | null,
): Promise<FolderRow> {
  const result = await pool.query<FolderRow>(
    'INSERT INTO folders (id, name, parent_id) VALUES ($1, $2, $3) RETURNING *',
    [id, name, parentId ?? null],
  );
  return result.rows[0];
}

export async function listFolders(parentId?: string | null): Promise<FolderRow[]> {
  if (parentId) {
    const result = await pool.query<FolderRow>(
      'SELECT * FROM folders WHERE parent_id = $1 ORDER BY name ASC',
      [parentId],
    );
    return result.rows;
  }
  const result = await pool.query<FolderRow>(
    'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC',
  );
  return result.rows;
}

export async function renameFolder(id: string, name: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE folders SET name = $1 WHERE id = $2',
    [name, id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getFolder(id: string): Promise<FolderRow | null> {
  const result = await pool.query<FolderRow>(
    'SELECT * FROM folders WHERE id = $1',
    [id],
  );
  return result.rows[0] || null;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const folder = await getFolder(id);
  if (!folder) return false;

  // Move child documents to parent folder (or root)
  await pool.query(
    'UPDATE documents SET folder_id = $1 WHERE folder_id = $2',
    [folder.parent_id, id],
  );

  // Move child folders to parent folder (or root)
  await pool.query(
    'UPDATE folders SET parent_id = $1 WHERE parent_id = $2',
    [folder.parent_id, id],
  );

  const result = await pool.query('DELETE FROM folders WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function moveDocument(
  docId: string,
  folderId: string | null,
): Promise<boolean> {
  const result = await pool.query(
    'UPDATE documents SET folder_id = $1 WHERE id = $2',
    [folderId, docId],
  );
  return (result.rowCount ?? 0) > 0;
}
