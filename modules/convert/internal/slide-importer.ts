/** Contract: contracts/convert/rules.md */

/**
 * Import pipeline for presentations: .pptx/.odp -> Collabora HTML -> slides.
 *
 * 1. Validate file format is pptx/odp
 * 2. Send to Collabora for HTML conversion
 * 3. Parse HTML into PresentationContent
 * 4. Build and validate PresentationDocumentSnapshot
 */

import {
  PresentationSchemaVersion,
  PresentationDocumentSnapshotSchema,
  type PresentationDocumentSnapshot,
} from '../../document/contract/index.ts';
import { convertToHtml } from './libreoffice.ts';
import { htmlToSlides } from './slide-parser.ts';
import { isPresentationFormat } from './formats.ts';

export class SlideImportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SlideImportError';
  }
}

export interface SlideImportResult {
  documentId: string;
  snapshot: PresentationDocumentSnapshot;
}

/**
 * Import a .pptx/.odp file into a PresentationDocumentSnapshot.
 */
export async function importSlideFile(
  fileBuffer: Buffer,
  format: string,
  documentId: string,
  filename: string,
): Promise<SlideImportResult> {
  if (!isPresentationFormat(format)) {
    throw new SlideImportError(
      `Unsupported presentation format: ${format}`,
      'INVALID_FORMAT',
    );
  }

  if (fileBuffer.length === 0) {
    throw new SlideImportError('File is empty', 'EMPTY_FILE');
  }

  const html = await convertToHtml(fileBuffer, filename);
  const snapshot = buildSlideSnapshot(html);

  return { documentId, snapshot };
}

/**
 * Build a PresentationDocumentSnapshot from Collabora HTML.
 * Exported for testing without requiring Collabora.
 */
export function buildSlideSnapshot(html: string): PresentationDocumentSnapshot {
  const content = htmlToSlides(html);

  const snapshot = {
    documentType: 'presentation' as const,
    schemaVersion: PresentationSchemaVersion.current,
    content,
  };

  return PresentationDocumentSnapshotSchema.parse(snapshot);
}
