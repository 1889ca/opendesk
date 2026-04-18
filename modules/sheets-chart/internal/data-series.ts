/** Contract: contracts/sheets-chart/rules.md */

import { type SeriesData, type ChartError, makeChartError } from './types.ts';
import { getColor, type PaletteName } from './color-palette.ts';

export type DataOrientation = 'columns' | 'rows';

export interface ExtractOptions {
  orientation: DataOrientation;
  hasHeaders: boolean;
  seriesIndices?: number[];
  categoryIndex?: number;
  palette?: PaletteName;
}

export interface ExtractedData {
  categories: string[];
  series: SeriesData[];
}

export function extractSeries(
  data: string[][],
  options: ExtractOptions,
): ExtractedData | ChartError {
  if (data.length === 0) return makeChartError('No data provided');

  if (options.orientation === 'columns') {
    return extractFromColumns(data, options);
  }
  return extractFromRows(data, options);
}

function extractFromColumns(
  data: string[][],
  options: ExtractOptions,
): ExtractedData | ChartError {
  const { hasHeaders, palette } = options;
  const headerRow = hasHeaders ? 0 : -1;
  const dataStartRow = hasHeaders ? 1 : 0;
  const colCount = Math.max(...data.map((r) => r.length));

  if (colCount === 0) return makeChartError('No columns in data');

  const catIdx = options.categoryIndex ?? 0;
  const seriesIdx = options.seriesIndices ??
    Array.from({ length: colCount }, (_, i) => i).filter((i) => i !== catIdx);

  if (seriesIdx.length === 0) return makeChartError('No series columns specified');

  const categories: string[] = [];
  for (let r = dataStartRow; r < data.length; r++) {
    categories.push(data[r]?.[catIdx] ?? '');
  }

  const series: SeriesData[] = seriesIdx.map((colIdx, si) => {
    const name = headerRow >= 0 ? (data[headerRow]?.[colIdx] ?? `Series ${si + 1}`) : `Series ${si + 1}`;
    const values: number[] = [];
    for (let r = dataStartRow; r < data.length; r++) {
      values.push(parseNumeric(data[r]?.[colIdx]));
    }
    return { name, values, color: getColor(si, palette) };
  });

  return { categories, series };
}

function extractFromRows(
  data: string[][],
  options: ExtractOptions,
): ExtractedData | ChartError {
  const { hasHeaders, palette } = options;
  const headerCol = hasHeaders ? 0 : -1;
  const dataStartCol = hasHeaders ? 1 : 0;

  const catIdx = options.categoryIndex ?? 0;
  const rowCount = data.length;
  const maxCols = Math.max(...data.map((r) => r.length));

  if (maxCols === 0) return makeChartError('No data in rows');

  const seriesIdx = options.seriesIndices ??
    Array.from({ length: rowCount }, (_, i) => i).filter((i) => i !== catIdx);

  if (seriesIdx.length === 0) return makeChartError('No series rows specified');

  const categories: string[] = [];
  const catRow = data[catIdx] ?? [];
  for (let c = dataStartCol; c < maxCols; c++) {
    categories.push(catRow[c] ?? '');
  }

  const series: SeriesData[] = seriesIdx.map((rowIdx, si) => {
    const name = headerCol >= 0 ? (data[rowIdx]?.[0] ?? `Series ${si + 1}`) : `Series ${si + 1}`;
    const values: number[] = [];
    const row = data[rowIdx] ?? [];
    for (let c = dataStartCol; c < maxCols; c++) {
      values.push(parseNumeric(row[c]));
    }
    return { name, values, color: getColor(si, palette) };
  });

  return { categories, series };
}

function parseNumeric(val: string | undefined): number {
  if (val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}
