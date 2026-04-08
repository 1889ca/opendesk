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
import { isFormulaError } from './internal/types.ts';
import type { CellGrid, CellAddress, FormulaResult } from './internal/types.ts';

export function evaluateFormula(
  formula: string,
  grid: CellGrid,
  cellRef: CellAddress,
): FormulaResult {
  const ast = parse(formula);
  if (isFormulaError(ast)) return ast;
  return evaluate(ast, grid, cellRef);
}
