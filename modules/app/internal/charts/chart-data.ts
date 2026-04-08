/** Contract: contracts/app/charts.md */
import * as Y from 'yjs';
import type { ChartRange } from './chart-types.ts';

export interface ChartDataSet {
  labels: string[];
  series: { name: string; values: number[] }[];
}

/**
 * Extract chart data from a Yjs sheet array.
 * First row in range = labels, first column = series names.
 * Remaining cells = numeric values.
 */
export function extractChartData(
  ysheet: Y.Array<Y.Array<string>>,
  range: ChartRange,
): ChartDataSet {
  const { startRow, startCol, endRow, endCol } = range;
  const labels: string[] = [];
  const series: { name: string; values: number[] }[] = [];

  // First row = column labels (skip first cell which is corner)
  if (startRow <= endRow && ysheet.length > startRow) {
    const headerRow = ysheet.get(startRow);
    if (headerRow) {
      for (let c = startCol + 1; c <= endCol && c < headerRow.length; c++) {
        labels.push(headerRow.get(c) || `Col ${c - startCol}`);
      }
    }
  }

  // Remaining rows = data series
  for (let r = startRow + 1; r <= endRow && r < ysheet.length; r++) {
    const yrow = ysheet.get(r);
    if (!yrow) continue;

    const name = yrow.get(startCol) || `Row ${r - startRow}`;
    const values: number[] = [];

    for (let c = startCol + 1; c <= endCol && c < yrow.length; c++) {
      const raw = yrow.get(c) || '';
      const num = parseFloat(raw);
      values.push(isNaN(num) ? 0 : num);
    }

    series.push({ name, values });
  }

  // If no labels extracted, generate defaults
  if (labels.length === 0 && series.length > 0) {
    for (let i = 0; i < series[0].values.length; i++) {
      labels.push(`${i + 1}`);
    }
  }

  return { labels, series };
}

/**
 * Extract flat numeric values for pie charts.
 * Uses first data column only.
 */
export function extractPieData(
  ysheet: Y.Array<Y.Array<string>>,
  range: ChartRange,
): { labels: string[]; values: number[] } {
  const data = extractChartData(ysheet, range);
  const labels = data.series.map((s) => s.name);
  const values = data.series.map((s) => s.values[0] || 0);
  return { labels, values };
}
