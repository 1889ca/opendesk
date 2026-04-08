/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber } from './functions.ts';
import { colToIndex, indexToCol } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  const val = grid.get(key);
  if (val === undefined) return null;
  return val;
}

export function evaluateVLOOKUP(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 3 || args.length > 4) {
    return makeError(FormulaErrorType.VALUE, 'VLOOKUP requires 3 or 4 arguments');
  }

  const lookupValue = evalNode(args[0], grid, cellRef);
  if (isFormulaError(lookupValue)) return lookupValue;

  if (args[1].type !== 'range_ref') {
    return makeError(FormulaErrorType.VALUE, 'VLOOKUP second argument must be a range');
  }
  const range = args[1] as RangeRef;

  const colIndexResult = evalNode(args[2], grid, cellRef);
  if (isFormulaError(colIndexResult)) return colIndexResult;
  const colIdx = toNumber(colIndexResult);
  if (isFormulaError(colIdx)) return colIdx;

  const exactMatch = args.length === 4
    ? (() => { const v = evalNode(args[3], grid, cellRef); return v === false || v === 0; })()
    : false;

  return vlookup(lookupValue, range, Math.floor(colIdx), exactMatch, grid);
}

function vlookup(
  lookupValue: FormulaResult, range: RangeRef, colIndex: number,
  exactMatch: boolean, grid: CellGrid
): FormulaResult {
  const startCol = colToIndex(range.start.col);
  const endCol = colToIndex(range.end.col);
  const rangeCols = Math.abs(endCol - startCol) + 1;

  if (colIndex < 1 || colIndex > rangeCols) {
    return makeError(FormulaErrorType.REF, `VLOOKUP column index ${colIndex} out of range`);
  }

  const minCol = Math.min(startCol, endCol);
  const searchCol = indexToCol(minCol);
  const resultCol = indexToCol(minCol + colIndex - 1);
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);

  for (let row = startRow; row <= endRow; row++) {
    const cellVal = resolveCell(grid, `${searchCol}${row}`);
    if (matches(cellVal, lookupValue, exactMatch)) {
      return resolveCell(grid, `${resultCol}${row}`);
    }
  }

  return makeError(FormulaErrorType.NA, 'VLOOKUP: no match found');
}

function matches(cellVal: FormulaResult, lookupValue: FormulaResult, exact: boolean): boolean {
  if (exact) {
    return cellVal === lookupValue ||
      (typeof cellVal === 'string' && typeof lookupValue === 'string' &&
        cellVal.toLowerCase() === lookupValue.toLowerCase());
  }
  if (typeof cellVal === 'number' && typeof lookupValue === 'number') {
    return cellVal <= lookupValue;
  }
  return cellVal === lookupValue;
}
