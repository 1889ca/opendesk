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
