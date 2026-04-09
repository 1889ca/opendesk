/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { parseCsv, gridToCsv, normalizeGrid } from './csv-parser.ts';

describe('parseCsv', () => {
  it('parses simple CSV', () => {
    const result = parseCsv('a,b,c\n1,2,3');
    expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with commas', () => {
    const result = parseCsv('"hello, world",b\n1,2');
    expect(result).toEqual([['hello, world', 'b'], ['1', '2']]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const result = parseCsv('"say ""hello""",b');
    expect(result).toEqual([['say "hello"', 'b']]);
  });

  it('handles newlines inside quoted fields', () => {
    const result = parseCsv('"line1\nline2",b');
    expect(result).toEqual([['line1\nline2', 'b']]);
  });

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2');
    expect(result).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles empty input', () => {
    const result = parseCsv('');
    expect(result).toEqual([]);
  });

  it('handles single cell', () => {
    const result = parseCsv('hello');
    expect(result).toEqual([['hello']]);
  });

  it('handles trailing newline', () => {
    const result = parseCsv('a,b\n1,2\n');
    expect(result).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles empty cells', () => {
    const result = parseCsv(',b,\n,,');
    expect(result).toEqual([['', 'b', ''], ['', '', '']]);
  });
});

describe('gridToCsv', () => {
  it('produces valid CSV from grid', () => {
    const csv = gridToCsv([['a', 'b'], ['1', '2']]);
    expect(csv).toBe('a,b\n1,2');
  });

  it('quotes fields with commas', () => {
    const csv = gridToCsv([['hello, world', 'b']]);
    expect(csv).toBe('"hello, world",b');
  });

  it('escapes quotes in output', () => {
    const csv = gridToCsv([['say "hi"', 'b']]);
    expect(csv).toBe('"say ""hi""",b');
  });

  it('roundtrips through parse and export', () => {
    const original = 'Name,Age,"City, State"\n"O\'Brien",30,"New York, NY"';
    const grid = parseCsv(original);
    const exported = gridToCsv(grid);
    const reparsed = parseCsv(exported);
    expect(reparsed).toEqual(grid);
  });
});

describe('normalizeGrid', () => {
  it('pads short rows', () => {
    const grid = [['a', 'b', 'c'], ['1']];
    const result = normalizeGrid(grid);
    expect(result).toEqual([['a', 'b', 'c'], ['1', '', '']]);
  });

  it('returns unchanged if all rows equal', () => {
    const grid = [['a', 'b'], ['1', '2']];
    const result = normalizeGrid(grid);
    expect(result).toEqual(grid);
  });

  it('handles empty grid', () => {
    expect(normalizeGrid([])).toEqual([]);
  });
});
