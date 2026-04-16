/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, toString } from './functions.ts';
import { expandRange, colToIndex, indexToCol } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  return grid.get(key) ?? null;
}

/** Parse a criteria string like ">5", "<=3.14", "<>foo" */
function parseCriteria(criteria: FormulaResult): (val: FormulaResult) => boolean {
  if (isFormulaError(criteria)) return () => false;
  if (typeof criteria === 'string') {
    const ops: [string, (a: number, b: number) => boolean][] = [
      ['>=', (a, b) => a >= b], ['<=', (a, b) => a <= b], ['<>', (a, b) => a !== b],
      ['>', (a, b) => a > b], ['<', (a, b) => a < b], ['=', (a, b) => a === b],
    ];
    for (const [op, cmp] of ops) {
      if (criteria.startsWith(op)) {
        const rhs = criteria.slice(op.length);
        const rhsNum = Number(rhs);
        if (!isNaN(rhsNum)) return (val) => typeof val === 'number' && cmp(val, rhsNum);
        if (op === '<>') return (val) => String(val ?? '').toLowerCase() !== rhs.toLowerCase();
        if (op === '=') return (val) => String(val ?? '').toLowerCase() === rhs.toLowerCase();
        return () => false;
      }
    }
    const pattern = criteria.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${pattern}$`, 'i');
    return (val) => typeof val === 'string' && re.test(val);
  }
  return (val) => val === criteria;
}

/** AVERAGEIF(range, criteria, [avg_range]) */
export function evaluateAVERAGEIF(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'AVERAGEIF requires 2 or 3 arguments');
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'AVERAGEIF: first arg must be a range');
  const testKeys = expandRange(args[0] as RangeRef);
  const criteria = evalNode(args[1], grid, cellRef);
  if (isFormulaError(criteria)) return criteria;
  const test = parseCriteria(criteria);

  let sumKeys = testKeys;
  if (args.length === 3) {
    if (args[2].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'AVERAGEIF: avg_range must be a range');
    sumKeys = expandRange(args[2] as RangeRef);
  }
  let total = 0;
  let count = 0;
  for (let i = 0; i < testKeys.length; i++) {
    if (test(resolveCell(grid, testKeys[i]))) {
      const val = resolveCell(grid, sumKeys[i] ?? testKeys[i]);
      if (typeof val === 'number') { total += val; count++; }
    }
  }
  if (count === 0) return makeError(FormulaErrorType.DIV0, 'AVERAGEIF: no matching values');
  return total / count;
}

/** COUNTIFS(range1, criteria1, range2, criteria2, ...) */
export function evaluateCOUNTIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length < 2 || args.length % 2 !== 0) {
    return makeError(FormulaErrorType.VALUE, 'COUNTIFS requires pairs of range, criteria');
  }
  const pairs: { keys: string[]; test: (v: FormulaResult) => boolean }[] = [];
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'COUNTIFS: ranges must be range refs');
    const keys = expandRange(args[i] as RangeRef);
    const crit = evalNode(args[i + 1], grid, cellRef);
    if (isFormulaError(crit)) return crit;
    pairs.push({ keys, test: parseCriteria(crit) });
  }
  const len = pairs[0].keys.length;
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (pairs.every((p) => p.test(resolveCell(grid, p.keys[i])))) count++;
  }
  return count;
}

/** SUMIFS(sum_range, criteria_range1, criteria1, ...) */
export function evaluateSUMIFS(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn,
): FormulaResult {
  if (args.length < 3 || args.length % 2 !== 1) {
    return makeError(FormulaErrorType.VALUE, 'SUMIFS requires sum_range + pairs of range, criteria');
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMIFS: first arg must be a range');
  const sumKeys = expandRange(args[0] as RangeRef);
  const pairs: { keys: string[]; test: (v: FormulaResult) => boolean }[] = [];
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMIFS: ranges must be range refs');
    const keys = expandRange(args[i] as RangeRef);
    const crit = evalNode(args[i + 1], grid, cellRef);
    if (isFormulaError(crit)) return crit;
    pairs.push({ keys, test: parseCriteria(crit) });
  }
  let total = 0;
  for (let i = 0; i < sumKeys.length; i++) {
    if (pairs.every((p) => p.test(resolveCell(grid, p.keys[i])))) {
      const val = resolveCell(grid, sumKeys[i]);
      if (typeof val === 'number') total += val;
    }
  }
  return total;
}

/** SUMPRODUCT(array1, array2, ...) */
export function evaluateSUMPRODUCT(
  args: ASTNode[], grid: CellGrid, _cellRef: CellAddress, _evalNode: EvalFn,
): FormulaResult {
  if (args.length === 0) return makeError(FormulaErrorType.VALUE, 'SUMPRODUCT requires at least 1 argument');
  const arrays: number[][] = [];
  for (const arg of args) {
    if (arg.type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMPRODUCT: args must be ranges');
    const keys = expandRange(arg as RangeRef);
    arrays.push(keys.map((k) => { const v = resolveCell(grid, k); return typeof v === 'number' ? v : 0; }));
  }
  const len = arrays[0].length;
  if (arrays.some((a) => a.length !== len)) {
    return makeError(FormulaErrorType.VALUE, 'SUMPRODUCT: arrays must be same size');
  }
  let total = 0;
  for (let i = 0; i < len; i++) {
    let product = 1;
    for (const arr of arrays) product *= arr[i];
    total += product;
  }
  return total;
}

/** HLOOKUP(lookup_value, range, row_index, [approx]) */
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
  const exact = args.length === 4 ? (() => { const v = evalNode(args[3], grid, cellRef); return v === false || v === 0; })() : false;

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
      ? cellVal === lookupValue || (typeof cellVal === 'string' && typeof lookupValue === 'string' && cellVal.toLowerCase() === lookupValue.toLowerCase())
      : (typeof cellVal === 'number' && typeof lookupValue === 'number' ? cellVal <= lookupValue : cellVal === lookupValue);
    if (isMatch && !exact) continue;
    if (isMatch) return resolveCell(grid, `${indexToCol(c)}${targetRow}`);
  }
  // For approximate: return last match
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

/** CHOOSE(index, val1, val2, ...) */
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
