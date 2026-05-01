/** Contract: contracts/sheets-formula/rules.md */

import { type ASTNode, type CellGrid, type CellAddress, type FormulaResult, type CellRef, type RangeRef, FormulaErrorType, makeError, isFormulaError } from './types.ts';
import { type MultiSheetGrid, resolveMultiSheetCell, expandCrossSheetRange } from './cross-sheet-types.ts';
import { evaluateComparison } from './evaluator-compare.ts';
import { getFunction, toNumber, toString } from './functions.ts';
import { evaluateVLOOKUP } from './evaluator-vlookup.ts';
import { evaluateCOUNTIF, evaluateSUMIF, evaluateINDEX, evaluateMATCH } from './evaluator-countif.ts';
import { evaluateSUMPRODUCT, evaluateHLOOKUP, evaluateCHOOSE } from './evaluator-aggregate.ts';
import { evaluateCOUNTIFS, evaluateSUMIFS, evaluateAVERAGEIF, evaluateAVERAGEIFS, evaluateMAXIFS, evaluateMINIFS } from './evaluator-multi-criteria.ts';
import { evaluateXLOOKUP } from './evaluator-xlookup.ts';
import './functions-text.ts'; // side-effect: registers text functions
import './functions-lookup.ts'; // side-effect: registers DATE, DATEDIF, FLOOR, CEILING, CONCAT
import './functions-logical.ts'; // side-effect: registers AND, OR, NOT, XOR, IF*, IS*, TRUE, FALSE, TYPE
import './functions-math-ext.ts'; // side-effect: registers INT, MOD, POWER, SQRT, LOG, EVEN, ODD, etc.
import './functions-stat.ts'; // side-effect: registers MEDIAN, STDEV, VAR, MODE, PRODUCT, etc.
import './functions-text-ext.ts'; // side-effect: registers SUBSTITUTE, FIND, SEARCH, TEXTJOIN, etc.
import './functions-date-ext.ts'; // side-effect: registers YEAR, MONTH, DAY, HOUR, WEEKDAY, etc.
import './functions-financial.ts'; // side-effect: registers PMT, FV, PV, NPV, IRR, RATE

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
export function evaluate(
  node: ASTNode,
  grid: CellGrid,
  cellRef: CellAddress,
  multiSheet?: MultiSheetGrid,
): FormulaResult {
  switch (node.type) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'boolean': return node.value;
    case 'cell_ref': return resolveCell(grid, cellRefToKey(node));
    case 'range_ref': return makeError(FormulaErrorType.VALUE, 'Range outside function');

    case 'cross_sheet_cell_ref': {
      if (!multiSheet) return makeError(FormulaErrorType.REF, `No multi-sheet context for ${node.sheet}!${cellRefToKey(node.ref)}`);
      const val = resolveMultiSheetCell(multiSheet, node.sheet, cellRefToKey(node.ref));
      if (val === null) {
        // null means sheet exists but cell is empty, OR sheet is missing
        if (!multiSheet.has(node.sheet)) return makeError(FormulaErrorType.REF, `Sheet not found: ${node.sheet}`);
        return null;
      }
      return val;
    }

    case 'cross_sheet_range_ref':
      return makeError(FormulaErrorType.VALUE, 'Cross-sheet range outside function');

    case 'unary_op': {
      const operand = evaluate(node.operand, grid, cellRef, multiSheet);
      if (isFormulaError(operand)) return operand;
      const num = toNumber(operand);
      if (isFormulaError(num)) return num;
      return node.op === '-' ? -num : num;
    }
    case 'binary_op': return evaluateBinaryOp(node, grid, cellRef, multiSheet);
    case 'function_call': return evaluateFunctionCall(node, grid, cellRef, multiSheet);
  }
}

function evaluateBinaryOp(
  node: { op: string; left: ASTNode; right: ASTNode },
  grid: CellGrid, cellRef: CellAddress, multiSheet?: MultiSheetGrid,
): FormulaResult {
  const left = evaluate(node.left, grid, cellRef, multiSheet);
  if (isFormulaError(left)) return left;
  const right = evaluate(node.right, grid, cellRef, multiSheet);
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

type EvalFn = (node: ASTNode, grid: CellGrid, cellRef: CellAddress, ms?: MultiSheetGrid) => FormulaResult;

function evaluateFunctionCall(
  node: { name: string; args: ASTNode[] },
  grid: CellGrid, cellRef: CellAddress, multiSheet?: MultiSheetGrid,
): FormulaResult {
  // Bind multiSheet into the evaluate callback passed to sub-evaluators
  const evalBound: EvalFn = (n, g, c, ms) => evaluate(n, g, c, ms ?? multiSheet);

  if (node.name === 'VLOOKUP') return evaluateVLOOKUP(node.args, grid, cellRef, evalBound);
  if (node.name === 'COUNTIF') return evaluateCOUNTIF(node.args, grid, cellRef, evalBound);
  if (node.name === 'SUMIF') return evaluateSUMIF(node.args, grid, cellRef, evalBound);
  if (node.name === 'INDEX') return evaluateINDEX(node.args, grid, cellRef, evalBound);
  if (node.name === 'MATCH') return evaluateMATCH(node.args, grid, cellRef, evalBound);
  if (node.name === 'SUMPRODUCT') return evaluateSUMPRODUCT(node.args, grid, cellRef, evalBound);
  if (node.name === 'HLOOKUP') return evaluateHLOOKUP(node.args, grid, cellRef, evalBound);
  if (node.name === 'CHOOSE') return evaluateCHOOSE(node.args, grid, cellRef, evalBound);
  if (node.name === 'COUNTIFS') return evaluateCOUNTIFS(node.args, grid, cellRef, evalBound);
  if (node.name === 'SUMIFS') return evaluateSUMIFS(node.args, grid, cellRef, evalBound);
  if (node.name === 'AVERAGEIF') return evaluateAVERAGEIF(node.args, grid, cellRef, evalBound);
  if (node.name === 'AVERAGEIFS') return evaluateAVERAGEIFS(node.args, grid, cellRef, evalBound);
  if (node.name === 'MAXIFS') return evaluateMAXIFS(node.args, grid, cellRef, evalBound);
  if (node.name === 'MINIFS') return evaluateMINIFS(node.args, grid, cellRef, evalBound);
  if (node.name === 'XLOOKUP') return evaluateXLOOKUP(node.args, grid, cellRef, evalBound);

  const resolvedArgs: FormulaResult[] = [];
  for (const arg of node.args) {
    if (arg.type === 'range_ref') {
      for (const key of expandRange(arg)) resolvedArgs.push(resolveCell(grid, key));
    } else if (arg.type === 'cross_sheet_range_ref') {
      if (!multiSheet) {
        resolvedArgs.push(makeError(FormulaErrorType.REF, `No multi-sheet context for ${arg.sheet}`));
      } else if (!multiSheet.has(arg.sheet)) {
        resolvedArgs.push(makeError(FormulaErrorType.REF, `Sheet not found: ${arg.sheet}`));
      } else {
        for (const [sheet, key] of expandCrossSheetRange(arg.sheet, arg.start, arg.end, expandRange)) {
          const val = resolveMultiSheetCell(multiSheet, sheet, key);
          resolvedArgs.push(val === null ? null : val);
        }
      }
    } else {
      resolvedArgs.push(evaluate(arg, grid, cellRef, multiSheet));
    }
  }

  const fn = getFunction(node.name);
  if (!fn) return makeError(FormulaErrorType.NAME, `Unknown function: ${node.name}`);
  return fn(resolvedArgs);
}
