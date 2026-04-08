/** Contract: contracts/sheets-formula/rules.md */

import type { Token, TokenType } from './types.ts';
import { FormulaErrorType, makeError } from './types.ts';
import type { FormulaError } from './types.ts';
import type { CellRef } from './types.ts';

const CELL_REF_PATTERN = /^\$?[A-Za-z]{1,3}\$?[0-9]+/;
const NUMBER_PATTERN = /^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/;
const FUNCTION_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/;
const BOOLEAN_PATTERN = /^(TRUE|FALSE)\b/i;

export function tokenize(formula: string): Token[] | FormulaError {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < formula.length) {
    if (formula[pos] === ' ' || formula[pos] === '\t') { pos++; continue; }

    const remaining = formula.slice(pos);
    const start = pos;

    // String literals
    if (formula[pos] === '"') {
      const end = formula.indexOf('"', pos + 1);
      if (end === -1) return makeError(FormulaErrorType.VALUE, `Unterminated string at position ${pos}`);
      tokens.push({ type: 'STRING', value: formula.slice(pos + 1, end), position: start });
      pos = end + 1;
      continue;
    }

    // Booleans (before function/cell ref check)
    const boolMatch = remaining.match(BOOLEAN_PATTERN);
    if (boolMatch && !remaining.match(FUNCTION_PATTERN)) {
      tokens.push({ type: 'BOOLEAN', value: boolMatch[0].toUpperCase(), position: start });
      pos += boolMatch[0].length;
      continue;
    }

    // Function names (must check before cell refs)
    const funcMatch = remaining.match(FUNCTION_PATTERN);
    if (funcMatch) {
      tokens.push({ type: 'FUNCTION', value: funcMatch[0].toUpperCase(), position: start });
      pos += funcMatch[0].length;
      continue;
    }

    // Cell references
    const cellMatch = remaining.match(CELL_REF_PATTERN);
    if (cellMatch) {
      tokens.push({ type: 'CELL_REF', value: cellMatch[0].toUpperCase(), position: start });
      pos += cellMatch[0].length;
      continue;
    }

    // Numbers
    const numMatch = remaining.match(NUMBER_PATTERN);
    if (numMatch) {
      tokens.push({ type: 'NUMBER', value: numMatch[0], position: start });
      pos += numMatch[0].length;
      continue;
    }

    // Double-char operators
    const twoChar = formula.slice(pos, pos + 2);
    const opMap: Record<string, TokenType> = {
      '<>': 'NEQ', '<=': 'LTE', '>=': 'GTE',
    };
    if (opMap[twoChar]) {
      tokens.push({ type: opMap[twoChar], value: twoChar, position: start });
      pos += 2;
      continue;
    }

    // Single-char operators
    const singleOps: Record<string, TokenType> = {
      '(': 'LPAREN', ')': 'RPAREN', ',': 'COMMA', ':': 'COLON',
      '+': 'PLUS', '-': 'MINUS', '*': 'STAR', '/': 'SLASH',
      '^': 'CARET', '&': 'AMPERSAND', '=': 'EQ', '<': 'LT', '>': 'GT',
    };
    if (singleOps[formula[pos]]) {
      tokens.push({ type: singleOps[formula[pos]], value: formula[pos], position: start });
      pos++;
      continue;
    }

    return makeError(FormulaErrorType.VALUE, `Unexpected character '${formula[pos]}' at position ${pos}`);
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return tokens;
}

export function parseCellRef(raw: string): CellRef {
  let i = 0;
  const colAbsolute = raw[i] === '$';
  if (colAbsolute) i++;
  let col = '';
  while (i < raw.length && /[A-Z]/i.test(raw[i])) { col += raw[i].toUpperCase(); i++; }
  const rowAbsolute = raw[i] === '$';
  if (rowAbsolute) i++;
  const row = parseInt(raw.slice(i), 10);
  return { type: 'cell_ref', col, row, colAbsolute, rowAbsolute };
}
