/** Contract: contracts/sheets-formula/rules.md */

import type { Token, TokenType, ASTNode, CellRef } from './types.ts';
import { FormulaErrorType, makeError } from './types.ts';
import type { FormulaError } from './types.ts';

// --- Tokenizer ---

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

    // Single/double-char operators
    const twoChar = formula.slice(pos, pos + 2);
    const opMap: Record<string, TokenType> = {
      '<>': 'NEQ', '<=': 'LTE', '>=': 'GTE',
    };
    if (opMap[twoChar]) {
      tokens.push({ type: opMap[twoChar], value: twoChar, position: start });
      pos += 2;
      continue;
    }

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

// --- Parser (recursive descent) ---

export function parse(formula: string): ASTNode | FormulaError {
  const raw = formula.startsWith('=') ? formula.slice(1) : formula;
  const tokens = tokenize(raw);
  if ('type' in tokens && tokens.type === 'error') return tokens;

  const tokenList = tokens as Token[];
  let current = 0;

  function peek(): Token { return tokenList[current]; }
  function advance(): Token { return tokenList[current++]; }
  function expect(type: TokenType): Token | FormulaError {
    const t = peek();
    if (t.type !== type) return makeError(FormulaErrorType.VALUE, `Expected ${type} but got ${t.type} at position ${t.position}`);
    return advance();
  }

  function parseExpression(): ASTNode | FormulaError {
    return parseComparison();
  }

  function parseComparison(): ASTNode | FormulaError {
    let left = parseConcatenation();
    if ('type' in left && left.type === 'error') return left;

    while (['EQ', 'NEQ', 'LT', 'GT', 'LTE', 'GTE'].includes(peek().type)) {
      const op = advance().value as ASTNode extends BinaryOpNode ? never : string;
      const right = parseConcatenation();
      if ('type' in right && right.type === 'error') return right;
      left = { type: 'binary_op', op: op as '+', left: left as ASTNode, right: right as ASTNode };
    }
    return left;
  }

  function parseConcatenation(): ASTNode | FormulaError {
    let left = parseAddSub();
    if ('type' in left && left.type === 'error') return left;

    while (peek().type === 'AMPERSAND') {
      advance();
      const right = parseAddSub();
      if ('type' in right && right.type === 'error') return right;
      left = { type: 'binary_op', op: '&', left: left as ASTNode, right: right as ASTNode };
    }
    return left;
  }

  function parseAddSub(): ASTNode | FormulaError {
    let left = parseMulDiv();
    if ('type' in left && left.type === 'error') return left;

    while (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = advance().value;
      const right = parseMulDiv();
      if ('type' in right && right.type === 'error') return right;
      left = { type: 'binary_op', op: op as '+', left: left as ASTNode, right: right as ASTNode };
    }
    return left;
  }

  function parseMulDiv(): ASTNode | FormulaError {
    let left = parsePower();
    if ('type' in left && left.type === 'error') return left;

    while (peek().type === 'STAR' || peek().type === 'SLASH') {
      const op = advance().value;
      const right = parsePower();
      if ('type' in right && right.type === 'error') return right;
      left = { type: 'binary_op', op: op as '*', left: left as ASTNode, right: right as ASTNode };
    }
    return left;
  }

  function parsePower(): ASTNode | FormulaError {
    let left = parseUnary();
    if ('type' in left && left.type === 'error') return left;

    while (peek().type === 'CARET') {
      advance();
      const right = parseUnary();
      if ('type' in right && right.type === 'error') return right;
      left = { type: 'binary_op', op: '^', left: left as ASTNode, right: right as ASTNode };
    }
    return left;
  }

  function parseUnary(): ASTNode | FormulaError {
    if (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = advance().value as '+' | '-';
      const operand = parseUnary();
      if ('type' in operand && operand.type === 'error') return operand;
      return { type: 'unary_op', op, operand: operand as ASTNode };
    }
    return parsePrimary();
  }

  function parsePrimary(): ASTNode | FormulaError {
    const token = peek();

    if (token.type === 'NUMBER') {
      advance();
      return { type: 'number', value: parseFloat(token.value) };
    }

    if (token.type === 'STRING') {
      advance();
      return { type: 'string', value: token.value };
    }

    if (token.type === 'BOOLEAN') {
      advance();
      return { type: 'boolean', value: token.value === 'TRUE' };
    }

    if (token.type === 'FUNCTION') {
      return parseFunctionCall();
    }

    if (token.type === 'CELL_REF') {
      advance();
      const cellRef = parseCellRef(token.value);
      if (peek().type === 'COLON') {
        advance();
        const endToken = expect('CELL_REF');
        if ('type' in endToken && endToken.type === 'error') return endToken as unknown as FormulaError;
        const endRef = parseCellRef((endToken as Token).value);
        return { type: 'range_ref', start: cellRef, end: endRef };
      }
      return cellRef;
    }

    if (token.type === 'LPAREN') {
      advance();
      const expr = parseExpression();
      if ('type' in expr && expr.type === 'error') return expr;
      const closeParen = expect('RPAREN');
      if ('type' in closeParen && closeParen.type === 'error') return closeParen as unknown as FormulaError;
      return expr;
    }

    return makeError(FormulaErrorType.VALUE, `Unexpected token '${token.value}' at position ${token.position}`);
  }

  function parseFunctionCall(): ASTNode | FormulaError {
    const nameToken = advance();
    const open = expect('LPAREN');
    if ('type' in open && open.type === 'error') return open as unknown as FormulaError;

    const args: ASTNode[] = [];
    if (peek().type !== 'RPAREN') {
      const first = parseExpression();
      if ('type' in first && first.type === 'error') return first;
      args.push(first as ASTNode);
      while (peek().type === 'COMMA') {
        advance();
        const arg = parseExpression();
        if ('type' in arg && arg.type === 'error') return arg;
        args.push(arg as ASTNode);
      }
    }

    const close = expect('RPAREN');
    if ('type' in close && close.type === 'error') return close as unknown as FormulaError;

    return { type: 'function_call', name: nameToken.value.toUpperCase(), args };
  }

  const result = parseExpression();
  if ('type' in result && result.type === 'error') return result;
  if (peek().type !== 'EOF') {
    return makeError(FormulaErrorType.VALUE, `Unexpected token '${peek().value}' at position ${peek().position}`);
  }
  return result as ASTNode;
}

type BinaryOpNode = never; // type-helper only

function parseCellRef(raw: string): CellRef {
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
