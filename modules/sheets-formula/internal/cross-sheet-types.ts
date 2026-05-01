/** Contract: contracts/sheets-formula/rules.md */

import type { CellRef, RangeRef, CellValue, FormulaError } from './types.ts';

/**
 * A cell reference qualified with a sheet name: Sheet2!A1 or 'My Sheet'!$B$3
 */
export type CrossSheetCellRef = {
  type: 'cross_sheet_cell_ref';
  sheet: string;       // decoded sheet name (unquoted)
  ref: CellRef;
};

/**
 * A range reference qualified with a sheet name: Sheet2!A1:B3 or 'My Sheet'!A1:C5
 */
export type CrossSheetRangeRef = {
  type: 'cross_sheet_range_ref';
  sheet: string;       // decoded sheet name (unquoted)
  start: CellRef;
  end: CellRef;
};

/**
 * A grid of multiple sheets. Keys are sheet names; values are maps of
 * cell-address -> cell value. The active sheet's data is both in this map
 * and passed separately as the flat CellGrid for backwards compatibility.
 */
export type MultiSheetGrid = ReadonlyMap<string, ReadonlyMap<string, CellValue | FormulaError>>;

/** Resolve a cell from the multi-sheet grid; returns null for missing sheets/cells. */
export function resolveMultiSheetCell(
  grid: MultiSheetGrid,
  sheet: string,
  key: string,
): CellValue | FormulaError | null {
  const sheetData = grid.get(sheet);
  if (!sheetData) return null;          // sheet not found → caller emits #REF!
  const val = sheetData.get(key);
  return val === undefined ? null : val;
}

/** Expand a cross-sheet range into [sheet, cellAddress] pairs. */
export function expandCrossSheetRange(
  sheet: string,
  start: CellRef,
  end: CellRef,
  expandRange: (r: { type: 'range_ref'; start: CellRef; end: CellRef }) => string[],
): Array<[string, string]> {
  const cells = expandRange({ type: 'range_ref', start, end });
  return cells.map((c) => [sheet, c]);
}
