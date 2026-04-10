/** Contract: contracts/app/charts.md */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { extractChartData, extractPieData } from './chart-data.ts';
import type { ChartRange } from './chart-types.ts';

// ---------------------------------------------------------------------------
// Helpers to build Yjs sheet structures
// ---------------------------------------------------------------------------

/** Build a Y.Array<Y.Array<string>> from a 2-D string array. */
function makeSheet(rows: string[][]): Y.Array<Y.Array<string>> {
  const doc = new Y.Doc();
  const sheet = doc.getArray<Y.Array<string>>('sheet');
  for (const rowData of rows) {
    const yrow = new Y.Array<string>();
    yrow.insert(0, rowData);
    sheet.push([yrow]);
  }
  return sheet;
}

/** Convenience: full-sheet range for a rows×cols grid. */
function fullRange(rows: string[][]): ChartRange {
  return {
    startRow: 0,
    startCol: 0,
    endRow: rows.length - 1,
    endCol: rows[0].length - 1,
  };
}

// ---------------------------------------------------------------------------
// extractChartData
// ---------------------------------------------------------------------------

describe('extractChartData', () => {
  it('extracts column labels from the first row (skipping corner cell)', () => {
    const rows = [
      ['', 'Q1', 'Q2', 'Q3'],
      ['Sales', '100', '200', '150'],
    ];
    const sheet = makeSheet(rows);
    const { labels } = extractChartData(sheet, fullRange(rows));
    expect(labels).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('extracts series names from the first column (skipping header row)', () => {
    const rows = [
      ['', 'Jan', 'Feb'],
      ['Revenue', '1000', '1200'],
      ['Cost', '500', '600'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series.map((s) => s.name)).toEqual(['Revenue', 'Cost']);
  });

  it('extracts numeric values for each series', () => {
    const rows = [
      ['', 'A', 'B'],
      ['S1', '10', '20'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].values).toEqual([10, 20]);
  });

  it('treats non-numeric cells as 0', () => {
    const rows = [
      ['', 'X'],
      ['S1', 'NaN-text'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].values).toEqual([0]);
  });

  it('treats empty cells as 0', () => {
    const rows = [
      ['', 'X'],
      ['S1', ''],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].values).toEqual([0]);
  });

  it('generates default column labels ("Col N") when header cells are empty', () => {
    const rows = [
      ['', '', ''],
      ['S1', '1', '2'],
    ];
    const sheet = makeSheet(rows);
    const { labels } = extractChartData(sheet, fullRange(rows));
    expect(labels).toEqual(['Col 1', 'Col 2']);
  });

  it('generates default series name ("Row N") when first-col cell is empty', () => {
    const rows = [
      ['', 'A'],
      ['', '5'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].name).toBe('Row 1');
  });

  it('handles a subrange that does not start at row 0 / col 0', () => {
    // Sheet is bigger; we extract only rows 1-2, cols 1-2.
    const rows = [
      ['ignore', 'ignore', 'ignore'],
      ['ignore', '',       'B'     ],
      ['ignore', 'S1',     '42'    ],
    ];
    const sheet = makeSheet(rows);
    const range: ChartRange = { startRow: 1, startCol: 1, endRow: 2, endCol: 2 };
    const { labels, series } = extractChartData(sheet, range);
    expect(labels).toEqual(['B']);
    expect(series[0].name).toBe('S1');
    expect(series[0].values).toEqual([42]);
  });

  it('generates numeric fallback labels when header row produces no labels', () => {
    // Only one row (data row, no header data columns)
    const rows = [['S1', '7', '8']];
    const sheet = makeSheet(rows);
    // Range: single row, so startRow === endRow — no data series rows after header.
    // Instead give a range with only data rows (no header).
    const range: ChartRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 2 };
    // labels will be empty (no c from startCol+1=1 to endCol=2 because startRow==endRow,
    // so the loop for labels runs but header row is row 0 which has values at col1/2).
    // Actually the header loop does run: cols 1..2 → '7','8'.
    const { labels } = extractChartData(sheet, range);
    expect(labels).toEqual(['7', '8']);
  });

  it('returns empty labels and series for an empty sheet', () => {
    const sheet = makeSheet([]);
    const range: ChartRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    const result = extractChartData(sheet, range);
    expect(result.labels).toEqual([]);
    expect(result.series).toEqual([]);
  });

  it('parses float values correctly', () => {
    const rows = [
      ['', 'X'],
      ['S1', '3.14'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].values[0]).toBeCloseTo(3.14);
  });

  it('parses negative values correctly', () => {
    const rows = [
      ['', 'X'],
      ['S1', '-99'],
    ];
    const sheet = makeSheet(rows);
    const { series } = extractChartData(sheet, fullRange(rows));
    expect(series[0].values[0]).toBe(-99);
  });
});

// ---------------------------------------------------------------------------
// extractPieData
// ---------------------------------------------------------------------------

describe('extractPieData', () => {
  it('returns series names as labels and first values column as values', () => {
    const rows = [
      ['', 'Q1', 'Q2'],
      ['Alpha', '10', '20'],
      ['Beta', '30', '40'],
    ];
    const sheet = makeSheet(rows);
    const { labels, values } = extractPieData(sheet, fullRange(rows));
    expect(labels).toEqual(['Alpha', 'Beta']);
    expect(values).toEqual([10, 30]);
  });

  it('returns 0 for a series with no numeric first value', () => {
    const rows = [
      ['', 'X'],
      ['A', 'bad'],
    ];
    const sheet = makeSheet(rows);
    const { values } = extractPieData(sheet, fullRange(rows));
    expect(values).toEqual([0]);
  });

  it('returns empty arrays for an empty sheet', () => {
    const sheet = makeSheet([]);
    const range: ChartRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    const { labels, values } = extractPieData(sheet, range);
    expect(labels).toEqual([]);
    expect(values).toEqual([]);
  });
});
