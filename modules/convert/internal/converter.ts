/** Contract: contracts/convert/rules.md */

/**
 * MVP converter — client-side HTML/text export via TipTap editor methods.
 *
 * The full Collabora pipeline (flush -> read snapshot -> LibreOffice convert)
 * is stubbed here and will be wired up when the convert container is running.
 * For now, the actual export happens client-side using editor.getHTML() and
 * editor.getText(), with the API endpoints provided as a future hook.
 */

import type { ExportFormat } from '../contract.ts';
import { getDocument } from '../../storage/internal/pg.ts';

// --- MVP Export Formats (no Collabora needed) ---

export type MvpExportFormat = 'html' | 'text';

export interface MvpExportResult {
  documentId: string;
  format: MvpExportFormat;
  content: string;
  title: string;
  exportedAt: string;
}

/**
 * Get document metadata for export (title, existence check).
 * Actual content export happens client-side for MVP.
 */
export async function getDocumentForExport(
  documentId: string
): Promise<{ title: string } | null> {
  const doc = await getDocument(documentId);
  if (!doc) return null;
  return { title: doc.title };
}

// --- Collabora Integration (future) ---

const COLLABORA_URL = process.env.COLLABORA_URL || 'http://localhost:9980';

/**
 * Placeholder: convert HTML to a binary format via Collabora's REST API.
 * Not yet implemented — requires the convert container to be running.
 */
export async function convertViaCollabora(
  html: string,
  targetFormat: ExportFormat
): Promise<Buffer> {
  throw new Error(
    `Collabora conversion to ${targetFormat} not yet implemented. ` +
    `Ensure the convert container is running at ${COLLABORA_URL}.`
  );
}
