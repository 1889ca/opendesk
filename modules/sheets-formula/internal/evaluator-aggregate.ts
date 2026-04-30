/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber } from './functions.ts';
import { expandRange, colToIndex, indexToCol } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  return grid.get(key) ?? null;
}

/** SUMPRODUCT(array1, array2, ...) — multiply corresponding elements and sum. */
export function evaluateSUMPRODUCT(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'SUMPRODUCT requires at least 1 argument');
  const arrays: FormulaResult[][] = [];
  let len = -1;
  for (const arg of args) {
    if (arg.type === 'range_ref') {
      const keys = expandRange(arg as RangeRef);
      if (len === -1) len = keys.length;
      else if (keys.length !== len) {
        return makeError(FormulaErrorType.VALUE, 'SUMPRODUCT: ranges must be the same size');
      }
      arrays.push(keys.map((k) => resolveCell(grid, k)));
    } else {
      const val = evalNode(arg, grid, cellRef);
      if (len === -1) len = 1;
      arrays.push([val]);
    }
  }
  let total = 0;
  for (let i = 0; i < len; i++) {
    let product = 1;
    for (const range of arrays) {
      const val = range[i];
      if (isFormulaError(val)) return val;
      product *= typeof val === 'number' ? val : (typeof val === 'boolean' ? (val ? 1 : 0) : 0);
    }
    total += product;
  }
  return total;
}

/** HLOOKUP(lookup_value, range, row_index, [exact]) */
export function evaluateHLOOKUP(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length < 3 || args.length > 4) {
    return makeError(FormulaErrorType.VALUE, 'HLOOKUP requires 3 or 4 arguments');
  }
  const lookupValue = evalNode(args[0], grid, cellRef);
  if (isFormulaError(lookupValue)) return lookupValue;
  if (args[1].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'HLOOKUP: second arg must be range');
  const range = args[1] as RangeRef;
  const rowIdx = toNumber(evalNode(args[2], grid, cellRef));
  if (isFormulaError(rowIdx)) return rowIdx;
  const exact = args.length === 4
    ? (() => { const v = evalNode(args[3], grid, cellRef); return v === false || v === 0; })()
    : false;

  const startCol = colToIndex(range.start.col);
  const endCol = colToIndex(range.end.col);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const startRow = Math.min(range.start.row, range.end.row);
  const row = Math.floor(rowIdx);
  if (row < 1) return makeError(FormulaErrorType.VALUE, 'HLOOKUP: row_index must be >= 1');
  const targetRow = startRow + row - 1;

  for (let c = minCol; c <= maxCol; c++) {
    const cellVal = resolveCell(grid, `${indexToCol(c)}${startRow}`);
    const isMatch = exact
      ? (cellVal === lookupValue ||
        (typeof cellVal === 'string' && typeof lookupValue === 'string' &&
          cellVal.toLowerCase() === lookupValue.toLowerCase()))
      : (typeof cellVal === 'number' && typeof lookupValue === 'number'
        ? cellVal <= lookupValue
        : cellVal === lookupValue);
    if (exact && isMatch) return resolveCell(grid, `${indexToCol(c)}${targetRow}`);
    if (!exact && isMatch) continue;
  }
  if (!exact) {
    for (let c = maxCol; c >= minCol; c--) {
      const cellVal = resolveCell(grid, `${indexToCol(c)}${startRow}`);
      if (typeof cellVal === 'number' && typeof lookupValue === 'number' && cellVal <= lookupValue) {
        return resolveCell(grid, `${indexToCol(c)}${targetRow}`);
      }
    }
  }
  return makeError(FormulaErrorType.NA, 'HLOOKUP: no match found');
}

/** CHOOSE(index, val1, val2, ...) — return the nth value. */
export function evaluateCHOOSE(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length < 2) return makeError(FormulaErrorType.VALUE, 'CHOOSE requires at least 2 arguments');
  const idx = toNumber(evalNode(args[0], grid, cellRef));
  if (isFormulaError(idx)) return idx;
  const i = Math.floor(idx);
  if (i < 1 || i >= args.length) return makeError(FormulaErrorType.VALUE, 'CHOOSE: index out of range');
  return evalNode(args[i], grid, cellRef);
}
