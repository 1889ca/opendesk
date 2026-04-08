/** Contract: contracts/sheets-formula/rules.md */

import type { ASTNode, CellGrid, CellAddress, FormulaResult, CellRef, RangeRef, FormulaError } from './types.ts';
import { FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { getFunction, toNumber, toString } from './functions.ts';
import './functions-text.ts'; // side-effect: registers text functions

/** Convert column letters to 1-based index: A=1, B=2, ..., Z=26, AA=27 */
export function colToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index;
}

/** Convert 1-based index back to column letters */
export function indexToCol(index: number): string {
  let result = '';
  while (index > 0) {
    const mod = (index - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    index = Math.floor((index - 1) / 26);
  }
  return result;
}

/** Format a cell ref as a string key for grid lookup */
function cellRefToKey(ref: CellRef): string {
  return `${ref.col}${ref.row}`;
}

/** Expand a range reference into a list of cell addresses */
export function expandRange(range: RangeRef): string[] {
  const startCol = colToIndex(range.start.col);
  const endCol = colToIndex(range.end.col);
  const startRow = range.start.row;
  const endRow = range.end.row;

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  const cells: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push(`${indexToCol(col)}${row}`);
    }
  }
  return cells;
}

/** Resolve a cell value from the grid (missing = null) */
function resolveCell(grid: CellGrid, key: string): FormulaResult {
  const val = grid.get(key);
  if (val === undefined) return null;
  return val;
}

/** Evaluate an AST node against a cell grid */
export function evaluate(node: ASTNode, grid: CellGrid, _cellRef: CellAddress): FormulaResult {
  switch (node.type) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'boolean': return node.value;

    case 'cell_ref': {
      const key = cellRefToKey(node);
      return resolveCell(grid, key);
    }

    case 'range_ref':
      return makeError(FormulaErrorType.VALUE, 'Range reference used outside of function');

    case 'unary_op': {
      const operand = evaluate(node.operand, grid, _cellRef);
      if (isFormulaError(operand)) return operand;
      const num = toNumber(operand);
      if (isFormulaError(num)) return num;
      return node.op === '-' ? -num : num;
    }

    case 'binary_op': return evaluateBinaryOp(node, grid, _cellRef);
    case 'function_call': return evaluateFunctionCall(node, grid, _cellRef);
  }
}

function evaluateBinaryOp(
  node: { op: string; left: ASTNode; right: ASTNode },
  grid: CellGrid, cellRef: CellAddress
): FormulaResult {
  const left = evaluate(node.left, grid, cellRef);
  if (isFormulaError(left)) return left;
  const right = evaluate(node.right, grid, cellRef);
  if (isFormulaError(right)) return right;

  if (node.op === '&') {
    const ls = toString(left);
    if (isFormulaError(ls)) return ls;
    const rs = toString(right);
    if (isFormulaError(rs)) return rs;
    return ls + rs;
  }

  // Comparison operators work on mixed types
  if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
    return evaluateComparison(node.op, left, right);
  }

  // Arithmetic operators require numbers
  const ln = toNumber(left);
  if (isFormulaError(ln)) return ln;
  const rn = toNumber(right);
  if (isFormulaError(rn)) return rn;

  switch (node.op) {
    case '+': return ln + rn;
    case '-': return ln - rn;
    case '*': return ln * rn;
    case '/': return rn === 0 ? makeError(FormulaErrorType.DIV0, 'Division by zero') : ln / rn;
    case '^': return Math.pow(ln, rn);
    default: return makeError(FormulaErrorType.VALUE, `Unknown operator: ${node.op}`);
  }
}

function evaluateComparison(op: string, left: FormulaResult, right: FormulaResult): FormulaResult {
  // null/empty coerce for comparison
  const l = left === null ? 0 : left;
  const r = right === null ? 0 : right;

  if (typeof l === 'string' && typeof r === 'string') {
    const cmp = l.localeCompare(r);
    switch (op) {
      case '=':  return cmp === 0;
      case '<>': return cmp !== 0;
      case '<':  return cmp < 0;
      case '>':  return cmp > 0;
      case '<=': return cmp <= 0;
      case '>=': return cmp >= 0;
    }
  }

  const ln = typeof l === 'number' ? l : Number(l);
  const rn = typeof r === 'number' ? r : Number(r);
  if (isNaN(ln) || isNaN(rn)) {
    return op === '<>' ? true : false;
  }

  switch (op) {
    case '=':  return ln === rn;
    case '<>': return ln !== rn;
    case '<':  return ln < rn;
    case '>':  return ln > rn;
    case '<=': return ln <= rn;
    case '>=': return ln >= rn;
    default: return false;
  }
}

function evaluateFunctionCall(
  node: { name: string; args: ASTNode[] },
  grid: CellGrid, cellRef: CellAddress
): FormulaResult {
  // Special handling for VLOOKUP (needs range access)
  if (node.name === 'VLOOKUP') return evaluateVLOOKUP(node.args, grid, cellRef);

  // Expand range refs into individual cell values for aggregate functions
  const resolvedArgs: FormulaResult[] = [];
  for (const arg of node.args) {
    if (arg.type === 'range_ref') {
      const cells = expandRange(arg);
      for (const key of cells) {
        resolvedArgs.push(resolveCell(grid, key));
      }
    } else {
      const val = evaluate(arg, grid, cellRef);
      resolvedArgs.push(val);
    }
  }

  const fn = getFunction(node.name);
  if (!fn) return makeError(FormulaErrorType.NAME, `Unknown function: ${node.name}`);
  return fn(resolvedArgs);
}

function evaluateVLOOKUP(
  args: ASTNode[], grid: CellGrid, cellRef: CellAddress
): FormulaResult {
  if (args.length < 3 || args.length > 4) {
    return makeError(FormulaErrorType.VALUE, 'VLOOKUP requires 3 or 4 arguments');
  }

  const lookupValue = evaluate(args[0], grid, cellRef);
  if (isFormulaError(lookupValue)) return lookupValue;

  // args[1] must be a range
  if (args[1].type !== 'range_ref') {
    return makeError(FormulaErrorType.VALUE, 'VLOOKUP second argument must be a range');
  }
  const range = args[1] as RangeRef;

  const colIndexResult = evaluate(args[2], grid, cellRef);
  if (isFormulaError(colIndexResult)) return colIndexResult;
  const colIndex = toNumber(colIndexResult);
  if (isFormulaError(colIndex)) return colIndex;

  const exactMatch = args.length === 4
    ? (() => { const v = evaluate(args[3], grid, cellRef); return v === false || v === 0; })()
    : false;

  return vlookup(lookupValue, range, Math.floor(colIndex), exactMatch, grid);
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
  // Approximate match: find largest value <= lookup value
  if (typeof cellVal === 'number' && typeof lookupValue === 'number') {
    return cellVal <= lookupValue;
  }
  return cellVal === lookupValue;
}
