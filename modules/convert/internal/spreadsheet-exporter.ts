/** Contract: contracts/convert/rules.md */

/**
 * Spreadsheet export pipeline:
 * - CSV: direct generation from cell grid (no Collabora needed)
 * - XLSX/ODS: build an HTML table from cell grid, send to Collabora
 *
 * Accepts a 2D string grid (matching the Yjs sheet data model).
 */

import { gridToCsv, type CellGrid } from './csv-parser.ts';
import { convertFile } from './libreoffice.ts';
import type { SpreadsheetExportFormat } from './spreadsheet-formats.ts';
import {
  isValidSpreadsheetExportFormat,
  getSpreadsheetExportMime,
  getSpreadsheetExportExt,
} from './spreadsheet-formats.ts';

export class SpreadsheetExportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SpreadsheetExportError';
  }
}

export interface SpreadsheetExportResult {
  fileBuffer: Buffer;
  mimeType: string;
  extension: string;
  exportedAt: string;
}

/**
 * Export a cell grid to the requested spreadsheet format.
 */
export async function exportSpreadsheet(
  grid: CellGrid,
  format: string,
  title: string = 'spreadsheet',
): Promise<SpreadsheetExportResult> {
  if (!isValidSpreadsheetExportFormat(format)) {
    throw new SpreadsheetExportError(
      `Unsupported spreadsheet export format: ${format}`,
      'INVALID_FORMAT',
    );
  }

  const exportedAt = new Date().toISOString();

  if (format === 'csv') {
    const csv = gridToCsv(grid);
    return {
      fileBuffer: Buffer.from(csv, 'utf-8'),
      mimeType: getSpreadsheetExportMime('csv'),
      extension: getSpreadsheetExportExt('csv'),
      exportedAt,
    };
  }

  // XLSX/ODS: build HTML table and convert via Collabora
  const html = gridToHtmlTable(grid, title);
  const htmlBuffer = Buffer.from(html, 'utf-8');
  const filename = `${title}.html`;

  const fileBuffer = await convertFile(
    htmlBuffer,
    filename,
    format as 'docx' | 'odt' | 'pdf',
  );

  return {
    fileBuffer,
    mimeType: getSpreadsheetExportMime(format as SpreadsheetExportFormat),
    extension: getSpreadsheetExportExt(format as SpreadsheetExportFormat),
    exportedAt,
  };
}

/** Convert a cell grid into an HTML table for Collabora conversion. */
function gridToHtmlTable(grid: CellGrid, title: string): string {
  const rows = grid.map((row) => {
    const cells = row.map((cell) => {
      const escaped = escapeHtml(cell);
      return `<td>${escaped}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n');

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="UTF-8">',
    `<title>${escapeHtml(title)}</title>`,
    '</head><body>',
    `<table>${rows}</table>`,
    '</body></html>',
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
