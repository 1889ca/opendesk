/** Contract: contracts/sheets-formula/rules.md */

import { type Token, type TokenType, type ASTNode, type FormulaError, FormulaErrorType, makeError } from './types.ts';
import { tokenize, parseCellRef } from './tokenizer.ts';

// Re-export tokenize for tests and consumers
export { tokenize } from './tokenizer.ts';

type BinaryOpNode = never; // type-helper only

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
    if (t.type !== type) {
      return makeError(FormulaErrorType.VALUE, `Expected ${type} but got ${t.type} at position ${t.position}`);
    }
    return advance();
  }

  function parseExpression(): ASTNode | FormulaError { return parseComparison(); }

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

    if (token.type === 'NUMBER') { advance(); return { type: 'number', value: parseFloat(token.value) }; }
    if (token.type === 'STRING') { advance(); return { type: 'string', value: token.value }; }
    if (token.type === 'BOOLEAN') { advance(); return { type: 'boolean', value: token.value === 'TRUE' }; }
    if (token.type === 'FUNCTION') return parseFunctionCall();

    if (token.type === 'CELL_REF') {
      advance();
      const ref = parseCellRef(token.value);
      if (peek().type === 'COLON') {
        advance();
        const endToken = expect('CELL_REF');
        if ('type' in endToken && endToken.type === 'error') return endToken as unknown as FormulaError;
        return { type: 'range_ref', start: ref, end: parseCellRef((endToken as Token).value) };
      }
      return ref;
    }

    if (token.type === 'LPAREN') {
      advance();
      const expr = parseExpression();
      if ('type' in expr && expr.type === 'error') return expr;
      const close = expect('RPAREN');
      if ('type' in close && close.type === 'error') return close as unknown as FormulaError;
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
