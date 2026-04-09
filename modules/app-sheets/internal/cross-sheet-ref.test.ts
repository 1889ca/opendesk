/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import {
  parseCrossSheetRef,
  quoteSheetName,
  parseCellRef,
  parseRangeRef,
} from './cross-sheet-ref.ts';

describe('parseCrossSheetRef', () => {
  it('parses simple cross-sheet reference', () => {
    const result = parseCrossSheetRef('Sheet2!A1');
    expect(result).toEqual({ sheetName: 'Sheet2', cellRef: 'A1' });
  });

  it('parses quoted sheet name with spaces', () => {
    const result = parseCrossSheetRef("'My Sheet'!B3");
    expect(result).toEqual({ sheetName: 'My Sheet', cellRef: 'B3' });
  });

  it('handles escaped quotes in sheet name', () => {
    const result = parseCrossSheetRef("'Bob''s Sheet'!C5");
    expect(result).toEqual({ sheetName: "Bob's Sheet", cellRef: 'C5' });
  });

  it('returns null for non-cross-sheet reference', () => {
    expect(parseCrossSheetRef('A1')).toBeNull();
    expect(parseCrossSheetRef('SUM(A1:B2)')).toBeNull();
  });

  it('returns null for empty sheet name', () => {
    expect(parseCrossSheetRef('!A1')).toBeNull();
  });

  it('returns null for empty cell ref', () => {
    expect(parseCrossSheetRef('Sheet1!')).toBeNull();
  });

  it('parses range reference after !', () => {
    const result = parseCrossSheetRef('Data!A1:C5');
    expect(result).toEqual({ sheetName: 'Data', cellRef: 'A1:C5' });
  });
});

describe('quoteSheetName', () => {
  it('does not quote simple names', () => {
    expect(quoteSheetName('Sheet1')).toBe('Sheet1');
    expect(quoteSheetName('Data')).toBe('Data');
  });

  it('quotes names with spaces', () => {
    expect(quoteSheetName('My Sheet')).toBe("'My Sheet'");
  });

  it('escapes existing quotes', () => {
    expect(quoteSheetName("Bob's")).toBe("'Bob''s'");
  });

  it('quotes names starting with digits', () => {
    expect(quoteSheetName('2024 Data')).toBe("'2024 Data'");
  });
});

describe('parseCellRef', () => {
  it('parses simple cell reference', () => {
    expect(parseCellRef('A1')).toEqual({ row: 0, col: 0 });
    expect(parseCellRef('B3')).toEqual({ row: 2, col: 1 });
    expect(parseCellRef('Z1')).toEqual({ row: 0, col: 25 });
  });

  it('parses multi-letter column', () => {
    expect(parseCellRef('AA1')).toEqual({ row: 0, col: 26 });
    expect(parseCellRef('AB1')).toEqual({ row: 0, col: 27 });
  });

  it('handles absolute references ($)', () => {
    expect(parseCellRef('$A$1')).toEqual({ row: 0, col: 0 });
    expect(parseCellRef('$B3')).toEqual({ row: 2, col: 1 });
    expect(parseCellRef('A$1')).toEqual({ row: 0, col: 0 });
  });

  it('is case insensitive', () => {
    expect(parseCellRef('a1')).toEqual({ row: 0, col: 0 });
    expect(parseCellRef('b2')).toEqual({ row: 1, col: 1 });
  });

  it('returns null for invalid references', () => {
    expect(parseCellRef('')).toBeNull();
    expect(parseCellRef('1A')).toBeNull();
    expect(parseCellRef('A0')).toBeNull();
  });
});

describe('parseRangeRef', () => {
  it('parses simple range', () => {
    expect(parseRangeRef('A1:C3')).toEqual({
      startRow: 0, startCol: 0, endRow: 2, endCol: 2,
    });
  });

  it('normalizes reversed range', () => {
    expect(parseRangeRef('C3:A1')).toEqual({
      startRow: 0, startCol: 0, endRow: 2, endCol: 2,
    });
  });

  it('handles single-row range', () => {
    expect(parseRangeRef('A1:D1')).toEqual({
      startRow: 0, startCol: 0, endRow: 0, endCol: 3,
    });
  });

  it('returns null for invalid ranges', () => {
    expect(parseRangeRef('A1')).toBeNull();
    expect(parseRangeRef('A1:B2:C3')).toBeNull();
    expect(parseRangeRef('')).toBeNull();
  });
});
