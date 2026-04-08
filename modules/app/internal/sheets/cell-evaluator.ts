/** Contract: contracts/sheets-tabs/rules.md */
import type { SheetStore } from './sheet-store.ts';
import { parseCrossSheetRef, parseCellRef, parseRangeRef } from './cross-sheet-ref.ts';

/**
 * Evaluate a cell value, resolving cross-sheet references.
 * For now, this handles simple display — the formula engine integration
 * adds cross-sheet support to full formula evaluation.
 *
 * If the value starts with '=', it's treated as a formula.
 * Cross-sheet references like Sheet2!A1 are resolved from the store.
 */
export function evaluateCellValue(
  rawValue: string, store: SheetStore, activeSheetId: string,
): string {
  if (!rawValue || !rawValue.startsWith('=')) return rawValue;

  const formula = rawValue.substring(1).trim();
  // Simple cross-sheet single-cell reference: =Sheet2!A1
  const crossRef = parseCrossSheetRef(formula);
  if (crossRef) {
    return resolveCrossSheetValue(crossRef.sheetName, crossRef.cellRef, store);
  }

  // Simple same-sheet cell reference: =A1
  const cellRef = parseCellRef(formula);
  if (cellRef) {
    return store.getCellValue(activeSheetId, cellRef.row, cellRef.col);
  }

  // Return raw for complex formulas (handled by formula engine if present)
  return rawValue;
}

function resolveCrossSheetValue(
  sheetName: string, cellRefStr: string, store: SheetStore,
): string {
  const sheetId = store.findSheetByName(sheetName);
  if (!sheetId) return '#REF!';

  const cellRef = parseCellRef(cellRefStr);
  if (cellRef) {
    return store.getCellValue(sheetId, cellRef.row, cellRef.col);
  }

  // Range references return comma-separated values
  const range = parseRangeRef(cellRefStr);
  if (range) {
    const values: string[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        values.push(store.getCellValue(sheetId, r, c));
      }
    }
    return values.filter(Boolean).join(', ');
  }

  return '#REF!';
}
