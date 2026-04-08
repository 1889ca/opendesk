/** Contract: contracts/convert/rules.md */

/**
 * Spreadsheet-specific format detection and MIME/extension mappings.
 * Extends the document-oriented format maps with spreadsheet types.
 */

export type SpreadsheetImportFormat = 'xlsx' | 'ods' | 'csv';
export type SpreadsheetExportFormat = 'xlsx' | 'ods' | 'csv';

const IMPORT_MIME_MAP: Record<string, SpreadsheetImportFormat> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'text/csv': 'csv',
  'application/csv': 'csv',
};

const IMPORT_EXT_MAP: Record<string, SpreadsheetImportFormat> = {
  '.xlsx': 'xlsx',
  '.ods': 'ods',
  '.csv': 'csv',
};

const EXPORT_MIME_MAP: Record<SpreadsheetExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
};

const EXPORT_EXT_MAP: Record<SpreadsheetExportFormat, string> = {
  xlsx: 'xlsx',
  ods: 'ods',
  csv: 'csv',
};

export function detectSpreadsheetFormat(
  mimeType?: string,
  filename?: string,
): SpreadsheetImportFormat | null {
  if (mimeType) {
    const fromMime = IMPORT_MIME_MAP[mimeType];
    if (fromMime) return fromMime;
  }
  if (filename) {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    const fromExt = IMPORT_EXT_MAP[ext];
    if (fromExt) return fromExt;
  }
  return null;
}

export function isValidSpreadsheetImportFormat(
  f: string,
): f is SpreadsheetImportFormat {
  return f === 'xlsx' || f === 'ods' || f === 'csv';
}

export function isValidSpreadsheetExportFormat(
  f: string,
): f is SpreadsheetExportFormat {
  return f === 'xlsx' || f === 'ods' || f === 'csv';
}

export function getSpreadsheetExportMime(
  format: SpreadsheetExportFormat,
): string {
  return EXPORT_MIME_MAP[format];
}

export function getSpreadsheetExportExt(
  format: SpreadsheetExportFormat,
): string {
  return EXPORT_EXT_MAP[format];
}

/** Collabora filter names for spreadsheet export. */
export function getSpreadsheetCollaboraFilter(
  format: SpreadsheetExportFormat,
): string {
  if (format === 'xlsx') return 'xlsx';
  if (format === 'ods') return 'ods';
  return 'csv';
}
