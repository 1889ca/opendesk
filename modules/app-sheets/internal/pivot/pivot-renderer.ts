/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import type { PivotResult, PivotConfig, ValueFieldConfig } from './pivot-engine.ts';
import { AGGREGATION_LABELS } from './pivot-aggregations.ts';
import type { DisplayMode } from './pivot-transforms.ts';
import type { SheetStore } from '../sheet-store.ts';

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

function fmt(val: number | null, displayMode?: DisplayMode): string {
  if (val === null) return '';
  if (displayMode && displayMode.startsWith('pct_')) return val.toFixed(1) + '%';
  if (displayMode === 'rank_asc' || displayMode === 'rank_desc') {
    return String(Math.round(val));
  }
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function valueLabel(vf: ValueFieldConfig, headers: string[]): string {
  const agg = AGGREGATION_LABELS[vf.aggregation];
  const field = headers[vf.fieldIndex] ?? `Col${vf.fieldIndex}`;
  return `${agg}(${field})`;
}

export function pivotToGrid(
  result: PivotResult,
  config: PivotConfig,
  displayModes?: DisplayMode[],
): string[][] {
  const { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = result;
  const { headers, rowFields, colFields, valueFields } = config;
  const vfCount = valueFields.length;

  const rowFieldLabels = rowFields.map((f) => headers[f] ?? `Col${f}`);
  const rowHeaderCols = Math.max(rowFieldLabels.length, 1);
  const colHeaderRows = Math.max(colFields.length, 1) + (vfCount > 1 ? 1 : 0);
  const dataCols = colKeys.length * vfCount;
  const totalCols = rowHeaderCols + dataCols + vfCount;
  const totalRows = colHeaderRows + rowKeys.length + 1;

  const grid: string[][] = Array.from({ length: totalRows }, () =>
    new Array(totalCols).fill(''),
  );

  for (let i = 0; i < rowFieldLabels.length; i++) {
    grid[colHeaderRows - 1][i] = rowFieldLabels[i];
  }

  for (let level = 0; level < colFields.length; level++) {
    for (let ci = 0; ci < colKeys.length; ci++) {
      grid[level][rowHeaderCols + ci * vfCount] = colKeys[ci][level] ?? '';
    }
  }

  if (vfCount > 1) {
    const subRow = colHeaderRows - 1;
    for (let ci = 0; ci < colKeys.length; ci++) {
      for (let vi = 0; vi < vfCount; vi++) {
        grid[subRow][rowHeaderCols + ci * vfCount + vi] =
          valueLabel(valueFields[vi], headers);
      }
    }
    for (let vi = 0; vi < vfCount; vi++) {
      grid[subRow][rowHeaderCols + dataCols + vi] =
        'Total ' + valueLabel(valueFields[vi], headers);
    }
  } else {
    grid[colHeaderRows - 1][rowHeaderCols + dataCols] = 'Total';
    if (colFields.length === 0) {
      grid[0][rowHeaderCols] = valueLabel(valueFields[0], headers);
    }
  }

  for (let ri = 0; ri < rowKeys.length; ri++) {
    const rk = rowKeys[ri];
    const dataRow = colHeaderRows + ri;

    for (let i = 0; i < rk.length; i++) grid[dataRow][i] = rk[i];

    for (let ci = 0; ci < colKeys.length; ci++) {
      const ck = colKeys[ci];
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const vals = cells.get(cellKey) ?? [];
      for (let vi = 0; vi < vfCount; vi++) {
        grid[dataRow][rowHeaderCols + ci * vfCount + vi] = fmt(
          vals[vi] ?? null,
          displayModes?.[vi],
        );
      }
    }

    const rtVals = rowTotals.get(keyOf(rk)) ?? [];
    for (let vi = 0; vi < vfCount; vi++) {
      grid[dataRow][rowHeaderCols + dataCols + vi] = fmt(rtVals[vi] ?? null);
    }
  }

  const totalRow = colHeaderRows + rowKeys.length;
  grid[totalRow][0] = 'Total';
  for (let ci = 0; ci < colKeys.length; ci++) {
    const ck = colKeys[ci];
    const ctVals = colTotals.get(keyOf(ck)) ?? [];
    for (let vi = 0; vi < vfCount; vi++) {
      grid[totalRow][rowHeaderCols + ci * vfCount + vi] =
        fmt(ctVals[vi] ?? null);
    }
  }
  for (let vi = 0; vi < vfCount; vi++) {
    grid[totalRow][rowHeaderCols + dataCols + vi] = fmt(grandTotal[vi] ?? null);
  }

  return grid;
}

export function writePivotToSheet(
  ydoc: Y.Doc,
  store: SheetStore,
  sheetId: string,
  pivotGrid: string[][],
): void {
  const ysheet = store.getSheetData(sheetId);

  ydoc.transact(() => {
    for (let r = 0; r < pivotGrid.length; r++) {
      if (r >= ysheet.length) {
        const newRow = new Y.Array<string>();
        newRow.insert(0, new Array(pivotGrid[r].length).fill(''));
        ysheet.insert(ysheet.length, [newRow]);
      }

      const yrow = ysheet.get(r);
      const rowData = pivotGrid[r];

      for (let c = 0; c < rowData.length; c++) {
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
