/** Contract: contracts/references/rules.md */
// #134 follow-up: factory + DI. See modules/kb/internal/pg-entries.ts.
import { pool } from '../../storage/internal/pool.ts';

export interface DocumentCitationRow {
  id: string;
  document_id: string;
  reference_id: string;
  locator: string | null;
  created_at: Date;
}

export async function linkCitation(
  id: string,
  documentId: string,
  referenceId: string,
  locator?: string,
): Promise<DocumentCitationRow> {
  const result = await pool.query<DocumentCitationRow>(
    `INSERT INTO document_citations (id, document_id, reference_id, locator)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (document_id, reference_id) DO UPDATE SET locator = $4
     RETURNING *`,
    [id, documentId, referenceId, locator ?? null],
  );
  return result.rows[0];
}

export async function unlinkCitation(
  documentId: string,
  referenceId: string,
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM document_citations WHERE document_id = $1 AND reference_id = $2',
    [documentId, referenceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listCitationsForDocument(
  documentId: string,
): Promise<DocumentCitationRow[]> {
  const result = await pool.query<DocumentCitationRow>(
    'SELECT * FROM document_citations WHERE document_id = $1 ORDER BY created_at ASC',
    [documentId],
  );
  return result.rows;
}

export async function listDocumentsForReference(
  referenceId: string,
): Promise<DocumentCitationRow[]> {
  const result = await pool.query<DocumentCitationRow>(
    'SELECT * FROM document_citations WHERE reference_id = $1 ORDER BY created_at ASC',
    [referenceId],
  );
  return result.rows;
}
