/** Contract: contracts/app-sheets/rules.md */

export type AggregationType = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';

export interface PivotConfig {
  /** Array of column indices to use as row grouping fields (in order). */
  rowFields: number[];
  /** Array of column indices to use as column grouping fields (in order). */
  colFields: number[];
  /** Column index of the value to aggregate. */
  valueField: number;
  /** Aggregation function. */
  aggregation: AggregationType;
  /** Raw source data rows (excluding header row). */
  dataRows: string[][];
  /** Header row for label resolution. */
  headers: string[];
}

export interface PivotResult {
  /** Ordered unique row keys (stringified tuple of row field values). */
  rowKeys: string[][];
  /** Ordered unique column keys (stringified tuple of col field values). */
  colKeys: string[][];
  /** Map from `rowKey|colKey` to aggregated value. */
  cells: Map<string, number | null>;
  /** Row totals keyed by row key join. */
  rowTotals: Map<string, number | null>;
  /** Column totals keyed by col key join. */
  colTotals: Map<string, number | null>;
  /** Grand total. */
  grandTotal: number | null;
}

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

function aggregate(values: number[], type: AggregationType): number | null {
  if (values.length === 0) return null;
  switch (type) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'COUNT':
      return values.length;
    case 'AVERAGE':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN':
      return Math.min(...values);
    case 'MAX':
      return Math.max(...values);
  }
}

/** Build a pivot table from the supplied config. Pure function — no side effects. */
export function buildPivot(config: PivotConfig): PivotResult {
  const { rowFields, colFields, valueField, aggregation, dataRows } = config;

  // Collect raw numeric values per (rowKey, colKey) cell
  const rawCells = new Map<string, number[]>();
  const rowKeySet = new Map<string, string[]>();
  const colKeySet = new Map<string, string[]>();

  for (const row of dataRows) {
    const rowParts = rowFields.map((f) => row[f] ?? '');
    const colParts = colFields.map((f) => row[f] ?? '');
    const rawVal = row[valueField] ?? '';
    const numVal = parseFloat(rawVal);

    const rk = keyOf(rowParts);
    const ck = keyOf(colParts);
    const cellKey = `${rk}|||${ck}`;

    if (!rowKeySet.has(rk)) rowKeySet.set(rk, rowParts);
    if (!colKeySet.has(ck)) colKeySet.set(ck, colParts);

    if (!isNaN(numVal) || aggregation === 'COUNT') {
      if (!rawCells.has(cellKey)) rawCells.set(cellKey, []);
      rawCells.get(cellKey)!.push(isNaN(numVal) ? 1 : numVal);
    }
  }

  // Sort row and column keys lexicographically
  const rowKeys = [...rowKeySet.values()].sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b)),
  );
  const colKeys = [...colKeySet.values()].sort((a, b) =>
    keyOf(a).localeCompare(keyOf(b)),
  );

  // Compute aggregated cells
  const cells = new Map<string, number | null>();
  for (const rk of rowKeys) {
    for (const ck of colKeys) {
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const vals = rawCells.get(cellKey) ?? [];
      cells.set(cellKey, aggregate(vals, aggregation));
    }
  }

  // Row totals
  const rowTotals = new Map<string, number | null>();
  for (const rk of rowKeys) {
    const allVals: number[] = [];
    for (const ck of colKeys) {
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const vals = rawCells.get(cellKey) ?? [];
      allVals.push(...vals);
    }
    rowTotals.set(keyOf(rk), aggregate(allVals, aggregation));
  }

  // Column totals
  const colTotals = new Map<string, number | null>();
  for (const ck of colKeys) {
    const allVals: number[] = [];
    for (const rk of rowKeys) {
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const vals = rawCells.get(cellKey) ?? [];
      allVals.push(...vals);
    }
    colTotals.set(keyOf(ck), aggregate(allVals, aggregation));
  }

  // Grand total
  const allVals: number[] = [];
  for (const [, vals] of rawCells) allVals.push(...vals);
  const grandTotal = aggregate(allVals, aggregation);

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal };
}

/** Helper — convert a cell address range string into row/col index arrays. */
export function parseSourceRange(
  rangeStr: string,
  sheetData: string[][],
): { headers: string[]; dataRows: string[][] } | null {
  // Expect format: "A1:Z50" (already parsed to array-of-arrays by caller)
  if (sheetData.length === 0) return null;
  const headers = sheetData[0];
  const dataRows = sheetData.slice(1);
  return { headers, dataRows };
}
