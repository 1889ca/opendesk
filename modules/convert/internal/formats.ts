/** Contract: contracts/convert/rules.md */

import type { ImportFormat, ExportFormat } from '../contract.ts';

/** MIME types accepted for import */
const IMPORT_MIME_MAP: Record<string, ImportFormat> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.presentation': 'odp',
};

/** File extensions to ImportFormat */
const IMPORT_EXT_MAP: Record<string, ImportFormat> = {
  '.docx': 'docx',
  '.odt': 'odt',
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.odp': 'odp',
};

/** ExportFormat to MIME type */
const EXPORT_MIME_MAP: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

/** ExportFormat to file extension (without dot) */
const EXPORT_EXT_MAP: Record<ExportFormat, string> = {
  docx: 'docx',
  odt: 'odt',
  pdf: 'pdf',
  pptx: 'pptx',
  odp: 'odp',
};

/** Collabora filter names for export conversion */
const COLLABORA_FILTER_MAP: Record<ExportFormat, string> = {
  pdf: 'pdf',
  docx: 'docx',
  odt: 'odt',
  pptx: 'pptx',
  odp: 'odp',
};

export function detectImportFormat(
  mimeType?: string,
  filename?: string
): ImportFormat | null {
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

export function isValidImportFormat(format: string): format is ImportFormat {
  return ['docx', 'odt', 'pdf', 'pptx', 'odp'].includes(format);
}

export function isValidExportFormat(format: string): format is ExportFormat {
  return ['docx', 'odt', 'pdf', 'pptx', 'odp'].includes(format);
}

/** Check if a format is a presentation format */
export function isPresentationFormat(format: string): boolean {
  return format === 'pptx' || format === 'odp';
}

export function getExportMimeType(format: ExportFormat): string {
  return EXPORT_MIME_MAP[format];
}

export function getExportExtension(format: ExportFormat): string {
  return EXPORT_EXT_MAP[format];
}

export function getCollaboraFilter(format: ExportFormat): string {
  return COLLABORA_FILTER_MAP[format];
}
