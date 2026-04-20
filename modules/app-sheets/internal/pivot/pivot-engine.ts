/** Contract: contracts/app-sheets/rules.md */
import { aggregate } from './pivot-aggregations.ts';
import type { AggregationType } from './pivot-aggregations.ts';

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

export function parseSourceRange(
  _rangeStr: string,
  sheetData: string[][],
): { headers: string[]; dataRows: string[][] } | null {
  if (sheetData.length === 0) return null;
  return { headers: sheetData[0], dataRows: sheetData.slice(1) };
}
