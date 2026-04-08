/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import {
  detectSpreadsheetFormat,
  isValidSpreadsheetImportFormat,
  isValidSpreadsheetExportFormat,
  getSpreadsheetExportMime,
  getSpreadsheetExportExt,
} from './spreadsheet-formats.ts';

describe('detectSpreadsheetFormat', () => {
  it('detects xlsx by MIME', () => {
    expect(detectSpreadsheetFormat(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )).toBe('xlsx');
  });

  it('detects ods by MIME', () => {
    expect(detectSpreadsheetFormat(
      'application/vnd.oasis.opendocument.spreadsheet',
    )).toBe('ods');
  });

  it('detects csv by MIME', () => {
    expect(detectSpreadsheetFormat('text/csv')).toBe('csv');
  });

  it('detects xlsx by extension', () => {
    expect(detectSpreadsheetFormat(undefined, 'data.xlsx')).toBe('xlsx');
  });

  it('detects csv by extension', () => {
    expect(detectSpreadsheetFormat(undefined, 'report.csv')).toBe('csv');
  });

  it('returns null for unknown format', () => {
    expect(detectSpreadsheetFormat('text/plain', 'notes.txt')).toBeNull();
  });

  it('prefers MIME over extension', () => {
    expect(detectSpreadsheetFormat('text/csv', 'data.xlsx')).toBe('csv');
  });
});

describe('isValidSpreadsheetImportFormat', () => {
  it('accepts valid formats', () => {
    expect(isValidSpreadsheetImportFormat('xlsx')).toBe(true);
    expect(isValidSpreadsheetImportFormat('ods')).toBe(true);
    expect(isValidSpreadsheetImportFormat('csv')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidSpreadsheetImportFormat('docx')).toBe(false);
    expect(isValidSpreadsheetImportFormat('pdf')).toBe(false);
  });
});

describe('isValidSpreadsheetExportFormat', () => {
  it('accepts valid formats', () => {
    expect(isValidSpreadsheetExportFormat('xlsx')).toBe(true);
    expect(isValidSpreadsheetExportFormat('ods')).toBe(true);
    expect(isValidSpreadsheetExportFormat('csv')).toBe(true);
  });
});

describe('getSpreadsheetExportMime', () => {
  it('returns correct MIME types', () => {
    expect(getSpreadsheetExportMime('csv')).toBe('text/csv');
    expect(getSpreadsheetExportMime('xlsx')).toContain('spreadsheetml');
    expect(getSpreadsheetExportMime('ods')).toContain('opendocument');
  });
});

describe('getSpreadsheetExportExt', () => {
  it('returns correct extensions', () => {
    expect(getSpreadsheetExportExt('csv')).toBe('csv');
    expect(getSpreadsheetExportExt('xlsx')).toBe('xlsx');
    expect(getSpreadsheetExportExt('ods')).toBe('ods');
  });
});
