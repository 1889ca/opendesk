/** Contract: contracts/convert/rules.md */

// Schemas (Zod)
export {
  ImportFormatSchema,
  ExportFormatSchema,
  ConversionRequestSchema,
  ConversionResultSchema,
  ConversionRequestedEventSchema,
  ExportReadyEventSchema,
  FlushConfigSchema,
} from './contract.ts';

// Types
export type {
  ImportFormat,
  ExportFormat,
  ConversionRequest,
  ConversionResult,
  ConversionRequestedEvent,
  ExportReadyEvent,
  FlushConfig,
} from './contract.ts';

// Converter (public API)
export {
  getDocumentForExport,
  convertViaCollabora,
  importViaCollabora,
  buildSnapshot,
  toConversionResult,
} from './internal/converter.ts';

export type {
  MvpExportFormat,
  MvpExportResult,
  ExportResult,
} from './internal/converter.ts';

// Format utilities
export {
  detectImportFormat,
  isValidImportFormat,
  isValidExportFormat,
  getExportMimeType,
  getExportExtension,
} from './internal/formats.ts';

// Collabora client
export {
  convertFile,
  convertToHtml,
  CollaboraError,
} from './internal/libreoffice.ts';

export type { CollaboraConfig } from './internal/libreoffice.ts';

// HTML parsing/rendering
export { htmlToProseMirrorJson } from './internal/html-parser.ts';
export { snapshotToHtml, contentToHtml } from './internal/html-renderer.ts';

// Import/Export pipelines
export { importFile, ImportError } from './internal/importer.ts';
export { exportDocument, ExportError } from './internal/exporter.ts';

// Spreadsheet import/export
export {
  importSpreadsheet,
  SpreadsheetImportError,
} from './internal/spreadsheet-importer.ts';
export type { SpreadsheetImportResult } from './internal/spreadsheet-importer.ts';

export {
  exportSpreadsheet,
  SpreadsheetExportError,
} from './internal/spreadsheet-exporter.ts';
export type { SpreadsheetExportResult } from './internal/spreadsheet-exporter.ts';

// Spreadsheet format utilities
export {
  detectSpreadsheetFormat,
  isValidSpreadsheetImportFormat,
  isValidSpreadsheetExportFormat,
  getSpreadsheetExportMime,
  getSpreadsheetExportExt,
} from './internal/spreadsheet-formats.ts';

// CSV parser (direct use by sheets editor)
export { parseCsv, gridToCsv, normalizeGrid } from './internal/csv-parser.ts';
export type { CellGrid } from './internal/csv-parser.ts';
