/** Contract: contracts/sheets-formula/rules.md */
import { z } from 'zod';

// --- Re-export core types from internal ---
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
  Token,
  TokenType,
} from './internal/types.ts';

export {
  FormulaErrorType,
  makeError,
  isFormulaError,
} from './internal/types.ts';

export type { FormulaError } from './internal/types.ts';

// --- Zod schemas for boundary validation ---

export const CellAddressSchema = z.string().regex(
  /^\$?[A-Z]{1,3}\$?[1-9][0-9]*$/,
  'Must be a valid cell address (e.g., A1, $B$3, AA100)'
);

export const FormulaStringSchema = z.string().refine(
  (s) => s.startsWith('='),
  { message: 'Formula must start with =' }
);

export const CellValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.null(),
]);

export const FormulaErrorTypeSchema = z.enum([
  '#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#N/A', '#NULL!', '#NUM!',
]);

export const FormulaErrorSchema = z.object({
  type: z.literal('error'),
  error: FormulaErrorTypeSchema,
  message: z.string(),
});

export const FormulaResultSchema = z.union([
  CellValueSchema,
  FormulaErrorSchema,
]);
