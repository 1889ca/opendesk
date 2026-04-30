/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber } from './functions.ts';
import { colToIndex, indexToCol, expandRange } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  return grid.get(key) ?? null;
}

/** Orientation of a range: vertical (column), horizontal (row), or single row/column only. */
type Orientation = { kind: 'vertical'; col: string; rows: number[] }
  | { kind: 'horizontal'; row: number; cols: string[] };

function orientOf(range: RangeRef): Orientation | import('./types.ts').FormulaError {
  const startCol = colToIndex(range.start.col);
  const endCol = colToIndex(range.end.col);
  const startRow = Math.min(range.start.row, range.end.row);
  const endRow = Math.max(range.start.row, range.end.row);
  const colCount = Math.abs(endCol - startCol) + 1;
  const rowCount = endRow - startRow + 1;

  if (colCount === 1) {
    const rows: number[] = [];
    for (let r = startRow; r <= endRow; r++) rows.push(r);
    return { kind: 'vertical', col: indexToCol(Math.min(startCol, endCol)), rows };
  }
  if (rowCount === 1) {
    const cols: string[] = [];
    const min = Math.min(startCol, endCol);
    const max = Math.max(startCol, endCol);
    for (let c = min; c <= max; c++) cols.push(indexToCol(c));
    return { kind: 'horizontal', row: startRow, cols };
  }
  return makeError(FormulaErrorType.VALUE, 'XLOOKUP lookup/return ranges must be a single row or column');
}

function equalsLoose(a: FormulaResult, b: FormulaResult): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return false;
}

/** Binary search over a sorted array index, returning the insertion position. */
function binarySearchPosition(
  values: FormulaResult[], target: FormulaResult, ascending: boolean
): number {
  let lo = 0;
  let hi = values.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = values[mid];
    const cmp = compareFor(v, target);
    if (cmp === 0) return mid;
    if (ascending ? cmp < 0 : cmp > 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return lo; // insertion point
}

function compareFor(a: FormulaResult, b: FormulaResult): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a ?? '').toLowerCase();
  const sb = String(b ?? '').toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * XLOOKUP(lookup, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])
 * match_mode: 0 exact (default), -1 exact or next smaller, 1 exact or next larger, 2 wildcard
 * search_mode: 1 first→last (default), -1 last→first, 2 binary asc, -2 binary desc
 */
export function evaluateXLOOKUP(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 3 || args.length > 6) {
    return makeError(FormulaErrorType.VALUE, 'XLOOKUP requires 3–6 arguments');
  }
  const lookup = evalNode(args[0], grid, cellRef);
  if (isFormulaError(lookup)) return lookup;

  if (args[1].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'XLOOKUP lookup_array must be a range');
  if (args[2].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'XLOOKUP return_array must be a range');

  const lookupOri = orientOf(args[1] as RangeRef);
  if (isFormulaError(lookupOri)) return lookupOri;

  const returnKeys = expandRange(args[2] as RangeRef);
  const lookupKeys = expandRange(args[1] as RangeRef);
  if (returnKeys.length % lookupKeys.length !== 0) {
    return makeError(FormulaErrorType.VALUE, 'XLOOKUP return_array must align with lookup_array');
  }
  const stride = returnKeys.length / lookupKeys.length;

  const matchMode = args.length >= 5 && args[4].type !== 'empty'
    ? toNumber(evalNode(args[4], grid, cellRef)) : 0;
  if (isFormulaError(matchMode)) return matchMode;
  const searchMode = args.length === 6 && args[5].type !== 'empty'
    ? toNumber(evalNode(args[5], grid, cellRef)) : 1;
  if (isFormulaError(searchMode)) return searchMode;

  const values = lookupKeys.map((k) => resolveCell(grid, k));
  const idx = findXLookupIndex(values, lookup, Math.trunc(matchMode), Math.trunc(searchMode));
  if (idx === -1) {
    if (args.length >= 4 && args[3].type !== 'empty') {
      return evalNode(args[3], grid, cellRef);
    }
    return makeError(FormulaErrorType.NA, 'XLOOKUP: no match found');
  }

  if (stride === 1) return resolveCell(grid, returnKeys[idx]);
  // Multi-column/row return: pick first cell in the matched row/column slice.
  return resolveCell(grid, returnKeys[idx * stride]);
}

function findXLookupIndex(
  values: FormulaResult[], target: FormulaResult, matchMode: number, searchMode: number
): number {
  if (searchMode === 2 || searchMode === -2) {
    const ascending = searchMode === 2;
    const pos = binarySearchPosition(values, target, ascending);
    if (pos < values.length && compareFor(values[pos], target) === 0) return pos;
    if (matchMode === -1) return ascending ? pos - 1 : pos;
    if (matchMode === 1) return ascending ? (pos < values.length ? pos : -1) : pos - 1;
    return -1;
  }

  const reverse = searchMode === -1;
  let bestIdx = -1;
  let bestVal: FormulaResult = null;
  const start = reverse ? values.length - 1 : 0;
  const end = reverse ? -1 : values.length;
  const step = reverse ? -1 : 1;

  for (let i = start; i !== end; i += step) {
    const v = values[i];
    if (matchMode === 2 && typeof target === 'string' && typeof v === 'string') {
      const pattern = target.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
      if (new RegExp(`^${pattern}$`, 'i').test(v)) return i;
      continue;
    }
    if (equalsLoose(v, target)) return i;
    if (matchMode === -1 && typeof v === 'number' && typeof target === 'number' && v < target) {
      if (bestVal === null || (typeof bestVal === 'number' && v > bestVal)) { bestIdx = i; bestVal = v; }
    }
    if (matchMode === 1 && typeof v === 'number' && typeof target === 'number' && v > target) {
      if (bestVal === null || (typeof bestVal === 'number' && v < bestVal)) { bestIdx = i; bestVal = v; }
    }
  }
  return bestIdx;
}
