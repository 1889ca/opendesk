/** Contract: contracts/sheets-formula/rules.md */

// --- Error Types ---

export const FormulaErrorType = {
  VALUE: '#VALUE!',
  REF: '#REF!',
  DIV0: '#DIV/0!',
  NAME: '#NAME?',
  NA: '#N/A',
  NULL: '#NULL!',
  NUM: '#NUM!',
} as const;

export type FormulaErrorType = (typeof FormulaErrorType)[keyof typeof FormulaErrorType];

export type FormulaError = {
  readonly type: 'error';
  readonly error: FormulaErrorType;
  readonly message: string;
};

export function makeError(error: FormulaErrorType, message: string): FormulaError {
  return { type: 'error', error, message };
}

export function isFormulaError(value: unknown): value is FormulaError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as FormulaError).type === 'error'
  );
}

// --- Cell Types ---

export type CellValue = number | string | boolean | null;
export type CellAddress = string; // e.g., "A1", "B3"
export type CellGrid = ReadonlyMap<string, CellValue | FormulaError>;

export type FormulaResult = CellValue | FormulaError;

// --- AST Node Types ---

// Imported here for union membership; cross-sheet-types.ts owns the definitions.
import type { CrossSheetCellRef, CrossSheetRangeRef } from './cross-sheet-types.ts';
export type { CrossSheetCellRef, CrossSheetRangeRef } from './cross-sheet-types.ts';

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellRef
  | RangeRef
  | CrossSheetCellRef
  | CrossSheetRangeRef
  | FunctionCall
  | BinaryOp
  | UnaryOp;

export type NumberLiteral = { type: 'number'; value: number };
export type StringLiteral = { type: 'string'; value: string };
export type BooleanLiteral = { type: 'boolean'; value: boolean };

export type CellRef = {
  type: 'cell_ref';
  col: string;       // "A", "B", etc.
  row: number;        // 1-based
  colAbsolute: boolean;
  rowAbsolute: boolean;
};

export type RangeRef = {
  type: 'range_ref';
  start: CellRef;
  end: CellRef;
};

export type FunctionCall = {
  type: 'function_call';
  name: string;       // uppercase normalized
  args: ASTNode[];
};

export type BinaryOp = {
  type: 'binary_op';
  op: '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';
  left: ASTNode;
  right: ASTNode;
};

export type UnaryOp = {
  type: 'unary_op';
  op: '+' | '-';
  operand: ASTNode;
};

// --- Token Types (for parser) ---

export type TokenType =
  | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'CELL_REF' | 'FUNCTION'
  | 'SHEET_PREFIX'   // e.g., "Sheet2!" or "'My Sheet'!" (decoded, bang stripped)
  | 'LPAREN' | 'RPAREN' | 'COMMA' | 'COLON'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'CARET' | 'AMPERSAND'
  | 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LTE' | 'GTE'
  | 'EOF';

export type Token = {
  type: TokenType;
  value: string;
  position: number;
};
