/** Contract: contracts/convert/rules.md */

/**
 * Unified converter facade — wires import and export pipelines
 * and provides the public API surface for the convert module.
 */

import type { ExportFormat, ImportFormat } from '../contract.ts';
import { importFile, buildSnapshot } from './importer.ts';
import {
  exportDocument,
  toConversionResult,
  type ExportResult,
} from './exporter.ts';
import { contentToHtml } from './html-renderer.ts';
import { getDocument } from '../../storage/index.ts';

export type { ExportResult };

// Re-export for backward compat with existing server.ts
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
 */
export async function getDocumentForExport(
  documentId: string
): Promise<{ title: string } | null> {
  const doc = await getDocument(documentId);
  if (!doc) return null;
  return { title: doc.title };
}

/**
 * Convert HTML content to a binary format via Collabora.
 * This is the main export path used by the API.
 */
export async function convertViaCollabora(
  html: string,
  targetFormat: ExportFormat,
  documentId: string,
  requestedBy: string = 'system'
): Promise<ExportResult> {
  const wrappedHtml = contentToHtml(html);
  return exportDocument(documentId, targetFormat, requestedBy, wrappedHtml);
}

/**
 * Import a file and return a DocumentSnapshot.
 */
export async function importViaCollabora(
  fileBuffer: Buffer,
  format: ImportFormat,
  documentId: string,
  filename: string
) {
  return importFile(fileBuffer, format, documentId, filename);
}

export { buildSnapshot, toConversionResult };
