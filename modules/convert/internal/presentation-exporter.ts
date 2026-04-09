/** Contract: contracts/convert/rules.md */

/**
 * Thin wrapper for exporting presentations via Collabora.
 * Accepts slide content directly (no flush coordination needed for slides).
 */

import type { ExportFormat } from '../contract.ts';
import { convertFile } from './libreoffice.ts';

export interface PresentationExportResult {
  fileBuffer: Buffer;
  stale: boolean;
  exportedAt: string;
}

/**
 * Export a presentation to the given format.
 * Converts slide content to an intermediate HTML representation,
 * then sends through Collabora for final format conversion.
 */
export async function exportPresentation(
  _documentId: string,
  format: string,
  content: { slides: unknown[] },
): Promise<PresentationExportResult> {
  const html = slidesToHtml(content.slides);
  const htmlBuffer = Buffer.from(html, 'utf-8');
  const fileBuffer = await convertFile(htmlBuffer, 'presentation.html', format as ExportFormat);

  return {
    fileBuffer,
    stale: false,
    exportedAt: new Date().toISOString(),
  };
}

/** Minimal HTML representation of slides for Collabora conversion. */
function slidesToHtml(slides: unknown[]): string {
  const slideHtml = slides
    .map((slide, i) => {
      const s = slide as Record<string, unknown>;
      const title = typeof s.title === 'string' ? s.title : `Slide ${i + 1}`;
      return `<section><h1>${escapeHtml(title)}</h1></section>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html><body>${slideHtml}</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
