/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { parseSourceRange } from './pivot-engine.ts';

// Full sheet used across tests — 6 columns (A-F), 4 data rows + 1 header
const FULL_SHEET: string[][] = [
  ['Region', 'Product', 'Q1',  'Q2',  'Secret1', 'Secret2'],
  ['East',   'Widget',  '100', '200', 'leak1',   'leak2'],
  ['West',   'Widget',  '150', '50',  'leak3',   'leak4'],
  ['East',   'Gadget',  '200', '300', 'leak5',   'leak6'],
  ['West',   'Gadget',  '300', '400', 'leak7',   'leak8'],
];

describe('parseSourceRange — basic parsing', () => {
  it('parses A1:D5 and returns expected headers and rows', () => {
    const result = parseSourceRange('A1:D5', FULL_SHEET);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Region', 'Product', 'Q1', 'Q2']);
    expect(result!.dataRows).toHaveLength(4);
  });

  it('header row comes from the first row of the range', () => {
    const result = parseSourceRange('A1:D5', FULL_SHEET);
    expect(result!.headers[0]).toBe('Region');
    expect(result!.headers[3]).toBe('Q2');
  });

  it('handles single-letter and two-letter column names', () => {
    // Z is col 25 (0-based), AA is col 26 — not in FULL_SHEET but parser should not crash
    const result = parseSourceRange('A1:B3', FULL_SHEET);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Region', 'Product']);
  });

  it('is case-insensitive for column letters', () => {
    const upper = parseSourceRange('A1:D5', FULL_SHEET);
    const lower = parseSourceRange('a1:d5', FULL_SHEET);
    expect(lower).toEqual(upper);
  });
});

describe('parseSourceRange — range boundary: cells outside selection are excluded (#512)', () => {
  it('excludes columns beyond the range end column', () => {
    // Select only A1:D5 — Secret1/Secret2 (cols E, F) must NOT appear
    const result = parseSourceRange('A1:D5', FULL_SHEET);
    expect(result).not.toBeNull();
    for (const row of [result!.headers, ...result!.dataRows]) {
      expect(row).not.toContain('Secret1');
      expect(row).not.toContain('Secret2');
      expect(row).not.toContain('leak1');
      expect(row).not.toContain('leak3');
      expect(row).not.toContain('leak5');
      expect(row).not.toContain('leak7');
      expect(row.length).toBeLessThanOrEqual(4);
    }
  });

  it('excludes rows beyond the range end row', () => {
    // Select only A1:D3 — rows 4 and 5 (Gadget rows) must NOT appear
    const result = parseSourceRange('A1:D3', FULL_SHEET);
    expect(result).not.toBeNull();
    // dataRows should be rows 2-3 only (2 rows, not 4)
    expect(result!.dataRows).toHaveLength(2);
    const regions = result!.dataRows.map((r) => r[0]);
    expect(regions).not.toContain('Gadget');
  });

  it('excludes rows before the range start row', () => {
    // Select starting from row 3 (0-based row 2: first West row)
    const result = parseSourceRange('A3:D5', FULL_SHEET);
    expect(result).not.toBeNull();
    // Row 3 becomes the header; rows 4-5 are data
    expect(result!.headers[0]).toBe('West');
    expect(result!.dataRows).toHaveLength(2);
  });

  it('excludes columns before the range start column', () => {
    // Select C1:D5 — Region and Product (cols A, B) must NOT appear
    const result = parseSourceRange('C1:D5', FULL_SHEET);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Q1', 'Q2']);
    for (const row of result!.dataRows) {
      expect(row).not.toContain('East');
      expect(row).not.toContain('West');
    }
  });
});

describe('parseSourceRange — invalid / malformed ranges', () => {
  it('returns null for empty rangeStr', () => {
    expect(parseSourceRange('', FULL_SHEET)).toBeNull();
  });

  it('returns null for malformed range string', () => {
    expect(parseSourceRange('invalid', FULL_SHEET)).toBeNull();
    expect(parseSourceRange('1A:2D', FULL_SHEET)).toBeNull();
    expect(parseSourceRange('A1D5', FULL_SHEET)).toBeNull();
  });

  it('returns null for reversed row range', () => {
    expect(parseSourceRange('A5:D1', FULL_SHEET)).toBeNull();
  });

  it('returns null for reversed column range', () => {
    expect(parseSourceRange('D1:A5', FULL_SHEET)).toBeNull();
  });

  it('returns null when start row exceeds sheet length', () => {
    expect(parseSourceRange('A99:D100', FULL_SHEET)).toBeNull();
  });

  it('returns null for empty sheetData', () => {
    expect(parseSourceRange('A1:D5', [])).toBeNull();
  });
});
