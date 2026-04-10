/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { toNumber, toString } from './functions.ts';
import { expandRange } from './evaluator.ts';

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress) => FormulaResult;

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  return grid.get(key) ?? null;
}

/** Parse a criteria string like ">5", "<=3.14", "<>foo", "=hello", or plain value */
function parseCriteria(criteria: FormulaResult): (val: FormulaResult) => boolean {
  if (isFormulaError(criteria)) return () => false;

  if (typeof criteria === 'string') {
    const ops: [string, (a: number, b: number) => boolean][] = [
      ['>=', (a, b) => a >= b],
      ['<=', (a, b) => a <= b],
      ['<>', (a, b) => a !== b],
      ['>', (a, b) => a > b],
      ['<', (a, b) => a < b],
      ['=', (a, b) => a === b],
    ];
    for (const [op, cmp] of ops) {
      if (criteria.startsWith(op)) {
        const rhs = criteria.slice(op.length);
        const rhsNum = Number(rhs);
        if (!isNaN(rhsNum)) {
          return (val) => typeof val === 'number' && cmp(val, rhsNum);
        }
        // String comparison for <>, =
        if (op === '<>') return (val) => String(val ?? '').toLowerCase() !== rhs.toLowerCase();
        if (op === '=') return (val) => String(val ?? '').toLowerCase() === rhs.toLowerCase();
        return () => false;
      }
    }
    // Wildcard matching (simple * and ? support)
    const pattern = criteria.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${pattern}$`, 'i');
    return (val) => typeof val === 'string' && re.test(val);
  }

  // Numeric / boolean exact match
  return (val) => val === criteria;
}

/** COUNTIF(range, criteria) */
export function evaluateCOUNTIF(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length !== 2) return makeError(FormulaErrorType.VALUE, 'COUNTIF requires 2 arguments');

  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'COUNTIF first argument must be a range');
  const range = args[0] as RangeRef;

  const criteria = evalNode(args[1], grid, cellRef);
  if (isFormulaError(criteria)) return criteria;
  const test = parseCriteria(criteria);

  let count = 0;
  for (const key of expandRange(range)) {
    if (test(resolveCell(grid, key))) count++;
  }
  return count;
}

/** SUMIF(range, criteria, [sum_range]) */
export function evaluateSUMIF(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'SUMIF requires 2 or 3 arguments');
  }

  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMIF first argument must be a range');
  const testRange = args[0] as RangeRef;
  const testKeys = expandRange(testRange);

  const criteria = evalNode(args[1], grid, cellRef);
  if (isFormulaError(criteria)) return criteria;
  const test = parseCriteria(criteria);

  let sumKeys: string[] = testKeys;
  if (args.length === 3) {
    if (args[2].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'SUMIF sum_range must be a range');
    sumKeys = expandRange(args[2] as RangeRef);
  }

  let total = 0;
  for (let i = 0; i < testKeys.length; i++) {
    if (test(resolveCell(grid, testKeys[i]))) {
      const sumKey = sumKeys[i] ?? testKeys[i];
      const val = resolveCell(grid, sumKey);
      if (typeof val === 'number') total += val;
    }
  }
  return total;
}

/** INDEX(range, row, [col]) */
export function evaluateINDEX(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'INDEX requires 2 or 3 arguments');
  }
  if (args[0].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'INDEX first argument must be a range');
  const range = args[0] as RangeRef;

  const rowArg = toNumber(evalNode(args[1], grid, cellRef));
  if (isFormulaError(rowArg)) return rowArg;

  const colArg = args.length === 3 ? toNumber(evalNode(args[2], grid, cellRef)) : 1;
  if (isFormulaError(colArg)) return colArg;

  const keys = expandRange(range);
  // Determine range dimensions
  const startCol = Math.min(range.start.col.charCodeAt(0), range.end.col.charCodeAt(0)) - 64;
  const endCol = Math.max(range.start.col.charCodeAt(0), range.end.col.charCodeAt(0)) - 64;
  const cols = endCol - startCol + 1;

  const row = Math.floor(rowArg);
  const col = Math.floor(colArg);

  if (row < 1 || col < 1) return makeError(FormulaErrorType.VALUE, 'INDEX row/col must be >= 1');

  const idx = (row - 1) * cols + (col - 1);
  if (idx >= keys.length) return makeError(FormulaErrorType.REF, 'INDEX: row/col out of range');

  return resolveCell(grid, keys[idx]);
}

/** MATCH(value, range, [match_type]) — 1=approx ascending, 0=exact, -1=approx descending */
export function evaluateMATCH(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress, evalNode: EvalFn
): FormulaResult {
  if (args.length < 2 || args.length > 3) {
    return makeError(FormulaErrorType.VALUE, 'MATCH requires 2 or 3 arguments');
  }
  if (args[1].type !== 'range_ref') return makeError(FormulaErrorType.VALUE, 'MATCH second argument must be a range');

  const lookupValue = evalNode(args[0], grid, cellRef);
  if (isFormulaError(lookupValue)) return lookupValue;

  const matchType = args.length === 3 ? toNumber(evalNode(args[2], grid, cellRef)) : 1;
  if (isFormulaError(matchType)) return matchType;

  const range = args[1] as RangeRef;
  const keys = expandRange(range);

  if (Math.floor(matchType) === 0) {
    // Exact match
    for (let i = 0; i < keys.length; i++) {
      const val = resolveCell(grid, keys[i]);
      if (val === lookupValue) return i + 1;
      if (typeof val === 'string' && typeof lookupValue === 'string' &&
        val.toLowerCase() === lookupValue.toLowerCase()) return i + 1;
    }
    return makeError(FormulaErrorType.NA, 'MATCH: no match found');
  }

  // Approximate match: find largest value <= lookup (type=1) or smallest >= lookup (type=-1)
  let bestIdx = -1;
  for (let i = 0; i < keys.length; i++) {
    const val = resolveCell(grid, keys[i]);
    if (typeof val !== 'number' || typeof lookupValue !== 'number') continue;
    if (matchType > 0 && val <= lookupValue) bestIdx = i;
    if (matchType < 0 && val >= lookupValue) { bestIdx = i; break; }
  }
  if (bestIdx === -1) return makeError(FormulaErrorType.NA, 'MATCH: no match found');
  return bestIdx + 1;
}
