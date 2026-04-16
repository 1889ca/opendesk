/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

const empty = grid({});

describe('INT', () => {
  it('truncates to integer (floor)', () => {
    expect(evaluateFormula('=INT(5.9)', empty, 'A1')).toBe(5);
    expect(evaluateFormula('=INT(-5.1)', empty, 'A1')).toBe(-6);
  });
});

describe('MOD', () => {
  it('returns remainder', () => {
    expect(evaluateFormula('=MOD(10, 3)', empty, 'A1')).toBe(1);
  });
  it('follows Excel sign convention', () => {
    expect(evaluateFormula('=MOD(-10, 3)', empty, 'A1')).toBe(2);
  });
  it('returns #DIV/0! for zero divisor', () => {
    const r = evaluateFormula('=MOD(10, 0)', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });
});

describe('POWER', () => {
  it('raises base to exponent', () => {
    expect(evaluateFormula('=POWER(2, 10)', empty, 'A1')).toBe(1024);
    expect(evaluateFormula('=POWER(9, 0.5)', empty, 'A1')).toBe(3);
  });
});

describe('SQRT', () => {
  it('returns square root', () => {
    expect(evaluateFormula('=SQRT(144)', empty, 'A1')).toBe(12);
  });
  it('returns #NUM! for negative', () => {
    const r = evaluateFormula('=SQRT(-4)', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('LOG / LN / LOG10 / EXP', () => {
  it('LOG defaults to base 10', () => {
    expect(evaluateFormula('=LOG(100)', empty, 'A1')).toBeCloseTo(2);
  });
  it('LOG with custom base', () => {
    expect(evaluateFormula('=LOG(8, 2)', empty, 'A1')).toBeCloseTo(3);
  });
  it('LN is natural log', () => {
    expect(evaluateFormula('=LN(1)', empty, 'A1')).toBe(0);
  });
  it('LOG10', () => {
    expect(evaluateFormula('=LOG10(1000)', empty, 'A1')).toBeCloseTo(3);
  });
  it('EXP raises e to power', () => {
    expect(evaluateFormula('=EXP(0)', empty, 'A1')).toBe(1);
    expect(evaluateFormula('=EXP(1)', empty, 'A1')).toBeCloseTo(Math.E);
  });
  it('LOG and LN error on non-positive', () => {
    expect((evaluateFormula('=LOG(0)', empty, 'A1') as FormulaError).error).toBe(FormulaErrorType.NUM);
    expect((evaluateFormula('=LN(-1)', empty, 'A1') as FormulaError).error).toBe(FormulaErrorType.NUM);
  });
});

describe('PI', () => {
  it('returns pi', () => {
    expect(evaluateFormula('=PI()', empty, 'A1')).toBeCloseTo(Math.PI);
  });
});

describe('RAND / RANDBETWEEN', () => {
  it('RAND returns 0-1', () => {
    const r = evaluateFormula('=RAND()', empty, 'A1') as number;
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });
  it('RANDBETWEEN returns within bounds', () => {
    const r = evaluateFormula('=RANDBETWEEN(1, 10)', empty, 'A1') as number;
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(10);
    expect(Number.isInteger(r)).toBe(true);
  });
});

describe('SIGN', () => {
  it('returns -1, 0, or 1', () => {
    expect(evaluateFormula('=SIGN(-42)', empty, 'A1')).toBe(-1);
    expect(evaluateFormula('=SIGN(0)', empty, 'A1')).toBe(0);
    expect(evaluateFormula('=SIGN(42)', empty, 'A1')).toBe(1);
  });
});
