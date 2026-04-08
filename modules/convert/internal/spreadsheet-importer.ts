/** Contract: contracts/convert/rules.md */

/**
 * Spreadsheet import pipeline:
 * - CSV: direct parse into cell grid (no Collabora needed)
 * - XLSX/ODS: Collabora converts to HTML, then parse <table> into cell grid
 *
 * Returns a normalized 2D string grid suitable for populating Yjs arrays.
 */

import { parseCsv, normalizeGrid, type CellGrid } from './csv-parser.ts';
import { convertToHtml } from './libreoffice.ts';
import { isValidSpreadsheetImportFormat } from './spreadsheet-formats.ts';

export class SpreadsheetImportError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SpreadsheetImportError';
  }
}

export interface SpreadsheetImportResult {
  grid: CellGrid;
  rowCount: number;
  colCount: number;
}

/**
 * Import a spreadsheet file into a normalized cell grid.
 */
export async function importSpreadsheet(
  fileBuffer: Buffer,
  format: string,
  filename: string,
): Promise<SpreadsheetImportResult> {
  if (!isValidSpreadsheetImportFormat(format)) {
    throw new SpreadsheetImportError(
      `Unsupported spreadsheet format: ${format}`,
      'INVALID_FORMAT',
    );
  }

  if (fileBuffer.length === 0) {
    throw new SpreadsheetImportError('File is empty', 'EMPTY_FILE');
  }

  let grid: CellGrid;

  if (format === 'csv') {
    const text = fileBuffer.toString('utf-8');
    grid = normalizeGrid(parseCsv(text));
  } else {
    // xlsx/ods -> Collabora HTML -> parse table cells
    const html = await convertToHtml(fileBuffer, filename);
    grid = normalizeGrid(parseHtmlTable(html));
  }

  if (grid.length === 0) {
    grid = [['']];
  }

  return {
    grid,
    rowCount: grid.length,
    colCount: grid[0]?.length || 1,
  };
}

/**
 * Parse an HTML string containing a <table> into a cell grid.
 * Collabora outputs spreadsheets as HTML tables when converting.
 */
function parseHtmlTable(html: string): CellGrid {
  const rows: CellGrid = [];

  // Extract all <tr>...</tr> blocks
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];

    // Extract <td> and <th> cell contents
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip inner HTML tags and decode basic entities
      const text = stripHtml(cellMatch[1]);
      cells.push(text);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

/** Strip HTML tags and decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
