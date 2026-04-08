/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { evaluateFormula, isFormulaError, FormulaErrorType } from '../index.ts';
import type { CellGrid, FormulaError } from '../index.ts';

/** Helper: build a CellGrid from a plain object */
function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('evaluator — arithmetic', () => {
  it('evaluates simple addition', () => {
    const g = grid({ A1: 10, B1: 20 });
    expect(evaluateFormula('=A1+B1', g, 'C1')).toBe(30);
  });

  it('evaluates subtraction', () => {
    const g = grid({ A1: 50, B1: 20 });
    expect(evaluateFormula('=A1-B1', g, 'C1')).toBe(30);
  });

  it('evaluates multiplication', () => {
    const g = grid({ A1: 5, B1: 4 });
    expect(evaluateFormula('=A1*B1', g, 'C1')).toBe(20);
  });

  it('evaluates division', () => {
    const g = grid({ A1: 20, B1: 4 });
    expect(evaluateFormula('=A1/B1', g, 'C1')).toBe(5);
  });

  it('returns #DIV/0! for division by zero', () => {
    const g = grid({ A1: 10, B1: 0 });
    const result = evaluateFormula('=A1/B1', g, 'C1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.DIV0);
  });

  it('evaluates power operator', () => {
    expect(evaluateFormula('=2^10', grid({}), 'A1')).toBe(1024);
  });

  it('evaluates operator precedence correctly', () => {
    expect(evaluateFormula('=2+3*4', grid({}), 'A1')).toBe(14);
  });

  it('evaluates parenthesized expressions', () => {
    expect(evaluateFormula('=(2+3)*4', grid({}), 'A1')).toBe(20);
  });

  it('evaluates unary negation', () => {
    const g = grid({ A1: 5 });
    expect(evaluateFormula('=-A1', g, 'B1')).toBe(-5);
  });
});

describe('evaluator — string & concatenation', () => {
  it('evaluates & operator', () => {
    const g = grid({ A1: 'hello', B1: ' world' });
    expect(evaluateFormula('=A1&B1', g, 'C1')).toBe('hello world');
  });

  it('evaluates CONCATENATE function', () => {
    const g = grid({ A1: 'foo', B1: 'bar' });
    expect(evaluateFormula('=CONCATENATE(A1,B1)', g, 'C1')).toBe('foobar');
  });
});

describe('evaluator — comparison operators', () => {
  it('evaluates equality', () => {
    const g = grid({ A1: 10, B1: 10 });
    expect(evaluateFormula('=A1=B1', g, 'C1')).toBe(true);
  });

  it('evaluates inequality', () => {
    const g = grid({ A1: 10, B1: 20 });
    expect(evaluateFormula('=A1<>B1', g, 'C1')).toBe(true);
  });

  it('evaluates less than', () => {
    const g = grid({ A1: 5, B1: 10 });
    expect(evaluateFormula('=A1<B1', g, 'C1')).toBe(true);
  });

  it('evaluates greater than or equal', () => {
    const g = grid({ A1: 10, B1: 10 });
    expect(evaluateFormula('=A1>=B1', g, 'C1')).toBe(true);
  });
});

describe('evaluator — aggregate functions', () => {
  const g = grid({ A1: 10, A2: 20, A3: 30, B1: 5, B2: 15, B3: 25 });

  it('SUM over a range', () => { expect(evaluateFormula('=SUM(A1:A3)', g, 'C1')).toBe(60); });
  it('SUM over 2D range', () => { expect(evaluateFormula('=SUM(A1:B3)', g, 'C1')).toBe(105); });
  it('AVERAGE', () => { expect(evaluateFormula('=AVERAGE(A1:A3)', g, 'C1')).toBe(20); });
  it('COUNT', () => { expect(evaluateFormula('=COUNT(A1:A3)', g, 'C1')).toBe(3); });
  it('MIN', () => { expect(evaluateFormula('=MIN(A1:B3)', g, 'C1')).toBe(5); });
  it('MAX', () => { expect(evaluateFormula('=MAX(A1:B3)', g, 'C1')).toBe(30); });
  it('SUM with multiple args', () => { expect(evaluateFormula('=SUM(A1,B1,10)', g, 'C1')).toBe(25); });
  it('SUM mixed range+scalar', () => { expect(evaluateFormula('=SUM(A1:A3,100)', g, 'C1')).toBe(160); });
});

describe('evaluator — IF', () => {
  it('true branch', () => {
    expect(evaluateFormula('=IF(A1>5, "big", "small")', grid({ A1: 10 }), 'B1')).toBe('big');
  });
  it('false branch', () => {
    expect(evaluateFormula('=IF(A1>5, "big", "small")', grid({ A1: 2 }), 'B1')).toBe('small');
  });
  it('no else returns false', () => {
    expect(evaluateFormula('=IF(A1, "yes")', grid({ A1: 0 }), 'B1')).toBe(false);
  });
  it('nested IF', () => {
    expect(evaluateFormula('=IF(A1>=90,"A",IF(A1>=70,"B","C"))', grid({ A1: 75 }), 'B1')).toBe('B');
  });
});

describe('evaluator — ROUND & ABS', () => {
  it('ROUND', () => { expect(evaluateFormula('=ROUND(3.14159, 2)', grid({}), 'A1')).toBe(3.14); });
  it('ABS', () => { expect(evaluateFormula('=ABS(-42)', grid({}), 'A1')).toBe(42); });
});
