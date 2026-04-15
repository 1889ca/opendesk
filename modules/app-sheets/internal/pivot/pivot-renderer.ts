/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { PivotResult, PivotConfig } from './pivot-engine.ts';
import type { SheetStore } from '../sheet-store.ts';

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

function fmt(val: number | null): string {
  if (val === null) return '';
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

/**
 * Convert a PivotResult into a 2D array of strings suitable for writing
 * into a sheet. Returns rows × cols.
 */
export function pivotToGrid(result: PivotResult, config: PivotConfig): string[][] {
  const { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = result;
  const { headers, rowFields, colFields, valueField, aggregation } = config;

  const rowFieldLabels = rowFields.map((f) => headers[f] ?? `Col${f}`);
  const colFieldLabels = colFields.map((f) => headers[f] ?? `Col${f}`);
  const valueLabel = `${aggregation}(${headers[valueField] ?? `Col${valueField}`})`;

  // Determine header depth: one row per col grouping level + 1 data header row
  const colHeaderRows = Math.max(colFieldLabels.length, 1);
  const rowHeaderCols = Math.max(rowFieldLabels.length, 1);

  const totalCols = rowHeaderCols + colKeys.length + 1; // +1 for "Total"
  const totalRows = colHeaderRows + rowKeys.length + 1; // +1 for "Total"

  // Initialize grid
  const grid: string[][] = Array.from({ length: totalRows }, () =>
    new Array(totalCols).fill(''),
  );

  // Top-left corner: row field labels
  for (let i = 0; i < rowFieldLabels.length; i++) {
    grid[colHeaderRows - 1][i] = rowFieldLabels[i];
  }

  // Column header rows: label for each colKey at each level
  for (let level = 0; level < colFieldLabels.length; level++) {
    // Row index for this header level
    const headerRow = level;
    if (level === 0) {
      // First level: print col field name in the left area
      grid[headerRow][rowHeaderCols - 1] = colFieldLabels[level];
    }
    for (let ci = 0; ci < colKeys.length; ci++) {
      grid[headerRow][rowHeaderCols + ci] = colKeys[ci][level] ?? '';
    }
    if (level === colFieldLabels.length - 1) {
      grid[headerRow][rowHeaderCols + colKeys.length] = 'Total';
    }
  }

  // If no col fields, still print value label header
  if (colFieldLabels.length === 0) {
    grid[0][rowHeaderCols] = valueLabel;
    grid[0][rowHeaderCols + 1] = 'Total';
  }

  // Data rows
  for (let ri = 0; ri < rowKeys.length; ri++) {
    const rk = rowKeys[ri];
    const dataRow = colHeaderRows + ri;

    // Row group labels
    for (let i = 0; i < rk.length; i++) {
      grid[dataRow][i] = rk[i];
    }

    // Cell values
    for (let ci = 0; ci < colKeys.length; ci++) {
      const ck = colKeys[ci];
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      grid[dataRow][rowHeaderCols + ci] = fmt(cells.get(cellKey) ?? null);
    }

    // Row total
    grid[dataRow][rowHeaderCols + colKeys.length] = fmt(rowTotals.get(keyOf(rk)) ?? null);
  }

  // Total row
  const totalRow = colHeaderRows + rowKeys.length;
  grid[totalRow][0] = 'Total';
  for (let ci = 0; ci < colKeys.length; ci++) {
    const ck = colKeys[ci];
    grid[totalRow][rowHeaderCols + ci] = fmt(colTotals.get(keyOf(ck)) ?? null);
  }
  grid[totalRow][rowHeaderCols + colKeys.length] = fmt(grandTotal);

  return grid;
}

/**
 * Write a pivot grid into a Yjs sheet. Extends the sheet if needed.
 * Writes starting at row 0, col 0.
 */
export function writePivotToSheet(
  ydoc: Y.Doc,
  store: SheetStore,
  sheetId: string,
  pivotGrid: string[][],
): void {
  const ysheet = store.getSheetData(sheetId);

  ydoc.transact(() => {
    for (let r = 0; r < pivotGrid.length; r++) {
      // Ensure row exists
      if (r >= ysheet.length) {
        const newRow = new Y.Array<string>();
        newRow.insert(0, new Array(pivotGrid[r].length).fill(''));
        ysheet.insert(ysheet.length, [newRow]);
      }

      const yrow = ysheet.get(r);
      const rowData = pivotGrid[r];

      for (let c = 0; c < rowData.length; c++) {
        // Ensure column exists
        if (c >= yrow.length) {
          yrow.insert(yrow.length, new Array(c - yrow.length + 1).fill(''));
        }
        if (yrow.get(c) !== rowData[c]) {
          yrow.delete(c, 1);
          yrow.insert(c, [rowData[c]]);
        }
      }
    }
  });
}
