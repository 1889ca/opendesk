/** Contract: contracts/sheets-formula/rules.md */

import type { ASTNode, CellGrid, CellAddress, FormulaResult, CellRef, RangeRef } from './types.ts';
import { FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { getFunction, toNumber, toString } from './functions.ts';
import { evaluateVLOOKUP } from './evaluator-vlookup.ts';
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

function cellRefToKey(ref: CellRef): string {
  return `${ref.col}${ref.row}`;
}

/** Expand a range reference into a list of cell addresses */
export function expandRange(range: RangeRef): string[] {
  const startCol = colToIndex(range.start.col);
  const endCol = colToIndex(range.end.col);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);

  const cells: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      cells.push(`${indexToCol(col)}${row}`);
    }
  }
  return cells;
}

function resolveCell(grid: CellGrid, key: string): FormulaResult {
  const val = grid.get(key);
  if (val === undefined) return null;
  return val;
}

/** Evaluate an AST node against a cell grid */
export function evaluate(node: ASTNode, grid: CellGrid, cellRef: CellAddress): FormulaResult {
  switch (node.type) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'boolean': return node.value;
    case 'cell_ref': return resolveCell(grid, cellRefToKey(node));
    case 'range_ref': return makeError(FormulaErrorType.VALUE, 'Range outside function');
    case 'unary_op': {
      const operand = evaluate(node.operand, grid, cellRef);
      if (isFormulaError(operand)) return operand;
      const num = toNumber(operand);
      if (isFormulaError(num)) return num;
      return node.op === '-' ? -num : num;
    }
    case 'binary_op': return evaluateBinaryOp(node, grid, cellRef);
    case 'function_call': return evaluateFunctionCall(node, grid, cellRef);
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

  if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
    return evaluateComparison(node.op, left, right);
  }

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
  const l = left === null ? 0 : left;
  const r = right === null ? 0 : right;

  if (typeof l === 'string' && typeof r === 'string') {
    const cmp = l.localeCompare(r);
    switch (op) {
      case '=': return cmp === 0; case '<>': return cmp !== 0;
      case '<': return cmp < 0;   case '>': return cmp > 0;
      case '<=': return cmp <= 0; case '>=': return cmp >= 0;
    }
  }

  const ln = typeof l === 'number' ? l : Number(l);
  const rn = typeof r === 'number' ? r : Number(r);
  if (isNaN(ln) || isNaN(rn)) return op === '<>' ? true : false;

  switch (op) {
    case '=': return ln === rn; case '<>': return ln !== rn;
    case '<': return ln < rn;   case '>': return ln > rn;
    case '<=': return ln <= rn; case '>=': return ln >= rn;
    default: return false;
  }
}

function evaluateFunctionCall(
  node: { name: string; args: ASTNode[] },
  grid: CellGrid, cellRef: CellAddress
): FormulaResult {
  if (node.name === 'VLOOKUP') {
    return evaluateVLOOKUP(node.args, grid, cellRef, evaluate);
  }

  const resolvedArgs: FormulaResult[] = [];
  for (const arg of node.args) {
    if (arg.type === 'range_ref') {
      for (const key of expandRange(arg)) resolvedArgs.push(resolveCell(grid, key));
    } else {
      resolvedArgs.push(evaluate(arg, grid, cellRef));
    }
  }

  const fn = getFunction(node.name);
  if (!fn) return makeError(FormulaErrorType.NAME, `Unknown function: ${node.name}`);
  return fn(resolvedArgs);
}
