/** Contract: contracts/storage/rules.md */
import { pool } from './pool.ts';

export interface VersionRow {
  id: string;
  document_id: string;
  content: Record<string, unknown>;
  title: string;
  created_by: string;
  created_at: Date;
  version_number: number;
}

export const CREATE_VERSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_number INTEGER NOT NULL,
    UNIQUE (document_id, version_number)
  )
`;

/**
 * Save a new version snapshot for a document.
 * Auto-increments version_number per document.
 */
export async function saveVersion(
  id: string,
  docId: string,
  content: Record<string, unknown>,
  title: string,
  createdBy: string,
): Promise<VersionRow> {
  const result = await pool.query<VersionRow>(
    `INSERT INTO document_versions (id, document_id, content, title, created_by, version_number)
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE(
         (SELECT MAX(version_number) FROM document_versions WHERE document_id = $2),
         0
       ) + 1
     )
     RETURNING *`,
    [id, docId, JSON.stringify(content), title, createdBy],
  );
  return result.rows[0];
}

/**
 * List all versions for a document, most recent first.
 */
export async function listVersions(docId: string): Promise<VersionRow[]> {
  const result = await pool.query<VersionRow>(
    `SELECT * FROM document_versions
     WHERE document_id = $1
     ORDER BY version_number DESC`,
    [docId],
  );
  return result.rows;
}

/**
 * Get a single version by its ID.
 */
export async function getVersion(versionId: string): Promise<VersionRow | null> {
  const result = await pool.query<VersionRow>(
    'SELECT * FROM document_versions WHERE id = $1',
    [versionId],
  );
  return result.rows[0] || null;
}

/**
 * Delete a single version by its ID.
 */
export async function deleteVersion(versionId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM document_versions WHERE id = $1',
    [versionId],
  );
  return (result.rowCount ?? 0) > 0;
}
