/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import {
  detectImportFormat,
  isValidImportFormat,
  isValidExportFormat,
  getExportMimeType,
  getExportExtension,
  getCollaboraFilter,
} from './formats.ts';

describe('detectImportFormat', () => {
  it('detects docx from MIME type', () => {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(detectImportFormat(mime)).toBe('docx');
  });

  it('detects odt from MIME type', () => {
    expect(detectImportFormat('application/vnd.oasis.opendocument.text'))
      .toBe('odt');
  });

  it('detects pdf from MIME type', () => {
    expect(detectImportFormat('application/pdf')).toBe('pdf');
  });

  it('detects format from filename extension', () => {
    expect(detectImportFormat(undefined, 'report.docx')).toBe('docx');
    expect(detectImportFormat(undefined, 'report.odt')).toBe('odt');
    expect(detectImportFormat(undefined, 'report.pdf')).toBe('pdf');
  });

  it('returns null for unsupported formats', () => {
    expect(detectImportFormat('text/plain')).toBeNull();
    expect(detectImportFormat(undefined, 'file.txt')).toBeNull();
  });

  it('prefers MIME type over filename', () => {
    expect(detectImportFormat('application/pdf', 'file.docx')).toBe('pdf');
  });

  it('falls back to filename when MIME is unknown', () => {
    expect(detectImportFormat('application/octet-stream', 'file.odt'))
      .toBe('odt');
  });
});

describe('isValidImportFormat', () => {
  it('accepts valid formats', () => {
    expect(isValidImportFormat('docx')).toBe(true);
    expect(isValidImportFormat('odt')).toBe(true);
    expect(isValidImportFormat('pdf')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidImportFormat('txt')).toBe(false);
    expect(isValidImportFormat('html')).toBe(false);
  });
});

describe('isValidExportFormat', () => {
  it('accepts valid formats', () => {
    expect(isValidExportFormat('docx')).toBe(true);
    expect(isValidExportFormat('odt')).toBe(true);
    expect(isValidExportFormat('pdf')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidExportFormat('html')).toBe(false);
  });
});

describe('getExportMimeType', () => {
  it('returns correct MIME types', () => {
    expect(getExportMimeType('pdf')).toBe('application/pdf');
    expect(getExportMimeType('docx')).toContain('wordprocessingml');
    expect(getExportMimeType('odt')).toContain('opendocument');
  });
});

describe('getExportExtension', () => {
  it('returns correct extensions', () => {
    expect(getExportExtension('pdf')).toBe('pdf');
    expect(getExportExtension('docx')).toBe('docx');
    expect(getExportExtension('odt')).toBe('odt');
  });
});

describe('getCollaboraFilter', () => {
  it('returns filter names', () => {
    expect(getCollaboraFilter('pdf')).toBe('pdf');
    expect(getCollaboraFilter('docx')).toBe('docx');
    expect(getCollaboraFilter('odt')).toBe('odt');
  });
});
