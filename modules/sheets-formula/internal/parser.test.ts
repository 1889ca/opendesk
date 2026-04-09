/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { tokenize, parse } from './parser.ts';
import { type ASTNode, type CellRef, type RangeRef, type FunctionCall, type BinaryOp, type Token, isFormulaError } from './types.ts';

describe('tokenizer', () => {
  it('tokenizes a simple addition', () => {
    const tokens = tokenize('A1+B2') as Token[];
    expect(tokens).toHaveLength(4); // CELL_REF, PLUS, CELL_REF, EOF
    expect(tokens[0]).toMatchObject({ type: 'CELL_REF', value: 'A1' });
    expect(tokens[1]).toMatchObject({ type: 'PLUS', value: '+' });
    expect(tokens[2]).toMatchObject({ type: 'CELL_REF', value: 'B2' });
    expect(tokens[3]).toMatchObject({ type: 'EOF' });
  });

  it('tokenizes a function call', () => {
    const tokens = tokenize('SUM(A1:B3)') as Token[];
    expect(tokens[0]).toMatchObject({ type: 'FUNCTION', value: 'SUM' });
    expect(tokens[1]).toMatchObject({ type: 'LPAREN' });
    expect(tokens[2]).toMatchObject({ type: 'CELL_REF', value: 'A1' });
    expect(tokens[3]).toMatchObject({ type: 'COLON' });
    expect(tokens[4]).toMatchObject({ type: 'CELL_REF', value: 'B3' });
    expect(tokens[5]).toMatchObject({ type: 'RPAREN' });
  });

  it('tokenizes string literals', () => {
    const tokens = tokenize('"hello world"') as Token[];
    expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello world' });
  });

  it('tokenizes comparison operators', () => {
    const tokens = tokenize('A1<>B1') as Token[];
    expect(tokens[1]).toMatchObject({ type: 'NEQ', value: '<>' });
  });

  it('tokenizes absolute cell references', () => {
    const tokens = tokenize('$A$1') as Token[];
    expect(tokens[0]).toMatchObject({ type: 'CELL_REF', value: '$A$1' });
  });

  it('tokenizes boolean values', () => {
    const tokens = tokenize('TRUE') as Token[];
    expect(tokens[0]).toMatchObject({ type: 'BOOLEAN', value: 'TRUE' });
  });

  it('returns error for unterminated string', () => {
    const result = tokenize('"unterminated');
    expect(isFormulaError(result)).toBe(true);
  });

  it('returns error for unexpected character', () => {
    const result = tokenize('A1 @ B1');
    expect(isFormulaError(result)).toBe(true);
  });

  it('tokenizes numbers with decimals', () => {
    const tokens = tokenize('3.14') as Token[];
    expect(tokens[0]).toMatchObject({ type: 'NUMBER', value: '3.14' });
  });

  it('handles whitespace between tokens', () => {
    const tokens = tokenize('A1 + B1') as Token[];
    expect(tokens).toHaveLength(4);
    expect(tokens[1]).toMatchObject({ type: 'PLUS' });
  });
});

describe('parser', () => {
  it('parses a number literal', () => {
    const ast = parse('=42') as ASTNode;
    expect(ast).toEqual({ type: 'number', value: 42 });
  });

  it('parses a string literal', () => {
    const ast = parse('="hello"') as ASTNode;
    expect(ast).toEqual({ type: 'string', value: 'hello' });
  });

  it('parses a boolean literal', () => {
    const ast = parse('=TRUE') as ASTNode;
    expect(ast).toEqual({ type: 'boolean', value: true });
  });

  it('parses a cell reference', () => {
    const ast = parse('=A1') as CellRef;
    expect(ast).toMatchObject({
      type: 'cell_ref', col: 'A', row: 1,
      colAbsolute: false, rowAbsolute: false,
    });
  });

  it('parses an absolute cell reference', () => {
    const ast = parse('=$A$1') as CellRef;
    expect(ast).toMatchObject({
      type: 'cell_ref', col: 'A', row: 1,
      colAbsolute: true, rowAbsolute: true,
    });
  });

  it('parses a mixed cell reference', () => {
    const ast = parse('=$A1') as CellRef;
    expect(ast).toMatchObject({
      type: 'cell_ref', col: 'A', row: 1,
      colAbsolute: true, rowAbsolute: false,
    });
  });

  it('parses a range reference', () => {
    const ast = parse('=A1:B3') as RangeRef;
    expect(ast.type).toBe('range_ref');
    expect(ast.start).toMatchObject({ col: 'A', row: 1 });
    expect(ast.end).toMatchObject({ col: 'B', row: 3 });
  });

  it('parses a function call with range', () => {
    const ast = parse('=SUM(A1:B3)') as FunctionCall;
    expect(ast.type).toBe('function_call');
    expect(ast.name).toBe('SUM');
    expect(ast.args).toHaveLength(1);
    expect(ast.args[0].type).toBe('range_ref');
  });

  it('parses nested function calls', () => {
    const ast = parse('=IF(A1>0, SUM(B1:B5), 0)') as FunctionCall;
    expect(ast.type).toBe('function_call');
    expect(ast.name).toBe('IF');
    expect(ast.args).toHaveLength(3);
    expect((ast.args[0] as BinaryOp).op).toBe('>');
    expect((ast.args[1] as FunctionCall).name).toBe('SUM');
  });

  it('parses binary operations with correct precedence', () => {
    const ast = parse('=1+2*3') as BinaryOp;
    expect(ast.type).toBe('binary_op');
    expect(ast.op).toBe('+');
    expect((ast.right as BinaryOp).op).toBe('*');
  });

  it('parses unary negation', () => {
    const ast = parse('=-A1') as ASTNode;
    expect(ast.type).toBe('unary_op');
  });

  it('parses parenthesized expressions', () => {
    const ast = parse('=(1+2)*3') as BinaryOp;
    expect(ast.op).toBe('*');
    expect((ast.left as BinaryOp).op).toBe('+');
  });

  it('parses concatenation operator', () => {
    const ast = parse('="hello"&" world"') as BinaryOp;
    expect(ast.op).toBe('&');
  });

  it('parses power operator', () => {
    const ast = parse('=2^3') as BinaryOp;
    expect(ast.op).toBe('^');
  });

  it('parses comparison operators', () => {
    const ops = ['=', '<>', '<', '>', '<=', '>='];
    for (const op of ops) {
      const formula = `=A1${op}B1`;
      const ast = parse(formula) as BinaryOp;
      expect(ast.type).toBe('binary_op');
      expect(ast.op).toBe(op);
    }
  });

  it('returns error for invalid formula', () => {
    const result = parse('=+*');
    expect(isFormulaError(result)).toBe(true);
  });

  it('returns error for unmatched parenthesis', () => {
    const result = parse('=(1+2');
    expect(isFormulaError(result)).toBe(true);
  });

  it('parses formulas without leading =', () => {
    const ast = parse('42') as ASTNode;
    expect(ast).toEqual({ type: 'number', value: 42 });
  });

  it('parses function names case-insensitively', () => {
    const ast = parse('=sum(1,2)') as FunctionCall;
    expect(ast.name).toBe('SUM');
  });

  it('parses multi-column cell references', () => {
    const ast = parse('=AA100') as CellRef;
    expect(ast).toMatchObject({ type: 'cell_ref', col: 'AA', row: 100 });
  });
});
