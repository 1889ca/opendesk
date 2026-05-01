/** Contract: contracts/sheets-formula/rules.md */

// --- Schemas (Zod) ---
export {
  CellAddressSchema,
  FormulaStringSchema,
  CellValueSchema,
  FormulaErrorTypeSchema,
  FormulaErrorSchema,
  FormulaResultSchema,
} from './contract.ts';

// --- Types ---
export type {
  ASTNode,
  CellRef,
  RangeRef,
  CrossSheetCellRef,
  CrossSheetRangeRef,
  FunctionCall,
  BinaryOp,
  UnaryOp,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  CellValue,
  CellAddress,
  CellGrid,
  FormulaResult,
  FormulaError,
  Token,
  TokenType,
  MultiSheetGrid,
} from './contract.ts';

// --- Error utilities ---
export { FormulaErrorType, makeError, isFormulaError } from './contract.ts';

// --- Core API ---
export { parse as parseFormula } from './internal/parser.ts';
export { evaluate, expandRange, colToIndex, indexToCol } from './internal/evaluator.ts';
export { extractDependencies, detectCircular } from './internal/circular-detect.ts';
export { registerFunction, getFunction, toNumber, toString } from './internal/functions.ts';

// --- Convenience: parse + evaluate in one call ---
import { parse } from './internal/parser.ts';
import { evaluate } from './internal/evaluator.ts';
import { type CellGrid, type CellAddress, type FormulaResult, isFormulaError } from './internal/types.ts';
import { type MultiSheetGrid } from './internal/cross-sheet-types.ts';

export function evaluateFormula(
  formula: string,
  grid: CellGrid,
  cellRef: CellAddress,
): FormulaResult {
  const ast = parse(formula);
  if (isFormulaError(ast)) return ast;
  return evaluate(ast, grid, cellRef);
}

/**
 * Parse and evaluate a formula that may contain cross-sheet references.
 * @param formula  The formula string (may contain Sheet2!A1 style refs).
 * @param grid     The active sheet's cell grid.
 * @param cellRef  The address of the cell being evaluated (for circular detection).
 * @param multiSheet  Map of sheet name -> cell grid for all sheets. Active sheet
 *                    should also be present here under its own name.
 */
export function evaluateFormulaMultiSheet(
  formula: string,
  grid: CellGrid,
  cellRef: CellAddress,
  multiSheet: MultiSheetGrid,
): FormulaResult {
  const ast = parse(formula);
  if (isFormulaError(ast)) return ast;
  return evaluate(ast, grid, cellRef, multiSheet);
}
