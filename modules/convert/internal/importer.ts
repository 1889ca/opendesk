/** Contract: contracts/convert/rules.md */

/**
 * Import pipeline: file -> Collabora HTML -> ProseMirror JSON -> DocumentSnapshot.
 *
 * 1. Validate file format
 * 2. Send to Collabora for HTML conversion
 * 3. Parse HTML into ProseMirror JSON
 * 4. Build and validate DocumentSnapshot
 */

import { TextSchemaVersion, DocumentSnapshotSchema, type DocumentSnapshot } from '../../document/contract/index.ts';
import { convertToHtml } from './libreoffice.ts';
import { htmlToProseMirrorJson } from './html-parser.ts';
import { isValidImportFormat } from './formats.ts';

export class ImportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface ImportResult {
  documentId: string;
  snapshot: DocumentSnapshot;
}

/**
 * Import a file into a DocumentSnapshot.
 */
export async function importFile(
  fileBuffer: Buffer,
  format: string,
  documentId: string,
  filename: string
): Promise<ImportResult> {
  if (!isValidImportFormat(format)) {
    throw new ImportError(
      `Unsupported import format: ${format}`,
      'INVALID_FORMAT'
    );
  }

  if (fileBuffer.length === 0) {
    throw new ImportError('File is empty', 'EMPTY_FILE');
  }

  const html = await convertToHtml(fileBuffer, filename);
  const snapshot = buildSnapshot(html);

  return { documentId, snapshot };
}

/**
 * Build a DocumentSnapshot from HTML content.
 * Exported for testing without requiring Collabora.
 */
export function buildSnapshot(html: string): DocumentSnapshot {
  const content = htmlToProseMirrorJson(html);

  const snapshot = {
    documentType: 'text' as const,
    schemaVersion: TextSchemaVersion.current,
    content,
  };

  return DocumentSnapshotSchema.parse(snapshot);
}
