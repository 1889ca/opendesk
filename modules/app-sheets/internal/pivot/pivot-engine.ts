/** Contract: contracts/app-sheets/rules.md */
import { aggregate, type AggregationType } from './pivot-aggregations.ts';

export type { AggregationType } from './pivot-aggregations.ts';

export interface ValueFieldConfig {
  fieldIndex: number;
  aggregation: AggregationType;
}

export interface PivotConfig {
  rowFields: number[];
  colFields: number[];
  valueFields: ValueFieldConfig[];
  dataRows: string[][];
  headers: string[];
}

export interface PivotResult {
  rowKeys: string[][];
  colKeys: string[][];
  cells: Map<string, (number | null)[]>;
  rowTotals: Map<string, (number | null)[]>;
  colTotals: Map<string, (number | null)[]>;
  grandTotal: (number | null)[];
}

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

export function buildPivot(config: PivotConfig): PivotResult {
  const { rowFields, colFields, valueFields, dataRows } = config;
  const vfCount = valueFields.length;

  const rawCells = new Map<string, number[][]>();
  const rowKeySet = new Map<string, string[]>();
  const colKeySet = new Map<string, string[]>();

  for (const row of dataRows) {
    const rowParts = rowFields.map((f) => row[f] ?? '');
    const colParts = colFields.map((f) => row[f] ?? '');
    const rk = keyOf(rowParts);
    const ck = keyOf(colParts);
    const cellKey = `${rk}|||${ck}`;

    if (!rowKeySet.has(rk)) rowKeySet.set(rk, rowParts);
    if (!colKeySet.has(ck)) colKeySet.set(ck, colParts);

    if (!rawCells.has(cellKey)) {
      rawCells.set(cellKey, valueFields.map(() => []));
    }
    const cellVals = rawCells.get(cellKey)!;
    for (let vi = 0; vi < vfCount; vi++) {
      const rawVal = row[valueFields[vi].fieldIndex] ?? '';
      const numVal = parseFloat(rawVal);
      if (!isNaN(numVal) || valueFields[vi].aggregation === 'COUNT') {
        cellVals[vi].push(isNaN(numVal) ? 1 : numVal);
      }
    }
  }

  const rowKeys = [...rowKeySet.values()].sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b)),
  );
  const colKeys = [...colKeySet.values()].sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b)),
  );

  const cells = new Map<string, (number | null)[]>();
  for (const rk of rowKeys) {
    for (const ck of colKeys) {
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const raw = rawCells.get(cellKey);
      cells.set(cellKey, valueFields.map((vf, vi) =>
        aggregate(raw?.[vi] ?? [], vf.aggregation),
      ));
    }
  }

  const rowTotals = computeRowTotals(rowKeys, colKeys, rawCells, valueFields);
  const colTotals = computeColTotals(rowKeys, colKeys, rawCells, valueFields);

  const allVals: number[][] = valueFields.map(() => []);
  for (const [, cellRaw] of rawCells) {
    for (let vi = 0; vi < vfCount; vi++) allVals[vi].push(...cellRaw[vi]);
  }
  const grandTotal = valueFields.map((vf, vi) =>
    aggregate(allVals[vi], vf.aggregation),
  );

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal };
}

function computeRowTotals(
  rowKeys: string[][],
  colKeys: string[][],
  rawCells: Map<string, number[][]>,
  valueFields: ValueFieldConfig[],
): Map<string, (number | null)[]> {
  const totals = new Map<string, (number | null)[]>();
  for (const rk of rowKeys) {
    const allVals: number[][] = valueFields.map(() => []);
    for (const ck of colKeys) {
      const raw = rawCells.get(`${keyOf(rk)}|||${keyOf(ck)}`);
      for (let vi = 0; vi < valueFields.length; vi++) {
        allVals[vi].push(...(raw?.[vi] ?? []));
      }
    }
    totals.set(keyOf(rk), valueFields.map((vf, vi) =>
      aggregate(allVals[vi], vf.aggregation),
    ));
  }
  return totals;
}

function computeColTotals(
  rowKeys: string[][],
  colKeys: string[][],
  rawCells: Map<string, number[][]>,
  valueFields: ValueFieldConfig[],
): Map<string, (number | null)[]> {
  const totals = new Map<string, (number | null)[]>();
  for (const ck of colKeys) {
    const allVals: number[][] = valueFields.map(() => []);
    for (const rk of rowKeys) {
      const raw = rawCells.get(`${keyOf(rk)}|||${keyOf(ck)}`);
      for (let vi = 0; vi < valueFields.length; vi++) {
        allVals[vi].push(...(raw?.[vi] ?? []));
      }
    }
    totals.set(keyOf(ck), valueFields.map((vf, vi) =>
      aggregate(allVals[vi], vf.aggregation),
    ));
  }
  return totals;
}

/** Parse a spreadsheet column letter(s) to a 0-based index (A→0, Z→25, AA→26). */
function colLetterToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Parse a range string of the form "A1:D50" and slice sheetData to only the
 * rows and columns within that range.  Row and column indices are 1-based in
 * the range string, 0-based in sheetData.
 *
 * Returns null and does NOT fall back to full sheet data when the range
 * string is absent, malformed, or out of bounds — callers must treat null
 * as a hard error.
 */
export function parseSourceRange(
  rangeStr: string,
  sheetData: string[][],
): { headers: string[]; dataRows: string[][] } | null {
  if (!rangeStr || sheetData.length === 0) return null;

  // Expected format: "A1:D50" (column letters + row numbers)
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(rangeStr.trim());
  if (!match) return null;

  const startCol = colLetterToIndex(match[1].toUpperCase());
  const startRow = parseInt(match[2], 10) - 1;  // 0-based
  const endCol   = colLetterToIndex(match[3].toUpperCase());
  const endRow   = parseInt(match[4], 10) - 1;  // 0-based

  if (startRow < 0 || endRow < startRow || startCol < 0 || endCol < startCol) {
    return null;
  }
  if (startRow >= sheetData.length) return null;

  const clampedEndRow = Math.min(endRow, sheetData.length - 1);

  const sliced = sheetData
    .slice(startRow, clampedEndRow + 1)
    .map((row) => row.slice(startCol, endCol + 1));

  if (sliced.length === 0) return null;

  return { headers: sliced[0], dataRows: sliced.slice(1) };
}
