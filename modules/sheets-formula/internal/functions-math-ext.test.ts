/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('POWER / SQRT', () => {
  it('POWER(2,10) = 1024', () => {
    expect(evaluateFormula('=POWER(2, 10)', grid({}), 'A1')).toBe(1024);
  });
  it('SQRT(144) = 12', () => {
    expect(evaluateFormula('=SQRT(144)', grid({}), 'A1')).toBe(12);
  });
  it('SQRT of negative returns #NUM!', () => {
    const r = evaluateFormula('=SQRT(-1)', grid({}), 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('LOG / LN / EXP / LOG10', () => {
  it('LOG(100) = 2 (base 10)', () => {
    expect(evaluateFormula('=LOG(100)', grid({}), 'A1')).toBeCloseTo(2);
  });
  it('LOG(8, 2) = 3', () => {
    expect(evaluateFormula('=LOG(8, 2)', grid({}), 'A1')).toBeCloseTo(3);
  });
  it('LN(EXP(1)) ≈ 1', () => {
    expect(evaluateFormula('=LN(EXP(1))', grid({}), 'A1')).toBeCloseTo(1);
  });
  it('LOG10(1000) = 3', () => {
    expect(evaluateFormula('=LOG10(1000)', grid({}), 'A1')).toBeCloseTo(3);
  });
  it('LOG10 of non-positive returns #NUM!', () => {
    const r = evaluateFormula('=LOG10(0)', grid({}), 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('MOD / INT / SIGN', () => {
  it('MOD(10, 3) = 1', () => {
    expect(evaluateFormula('=MOD(10, 3)', grid({}), 'A1')).toBe(1);
  });
  it('MOD follows Excel semantics for negatives', () => {
    expect(evaluateFormula('=MOD(-3, 2)', grid({}), 'A1')).toBe(1);
  });
  it('MOD division by zero', () => {
    const r = evaluateFormula('=MOD(5, 0)', grid({}), 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });
  it('INT(3.9) = 3', () => {
    expect(evaluateFormula('=INT(3.9)', grid({}), 'A1')).toBe(3);
  });
  it('INT(-3.1) = -4 (floor)', () => {
    expect(evaluateFormula('=INT(-3.1)', grid({}), 'A1')).toBe(-4);
  });
  it('SIGN', () => {
    expect(evaluateFormula('=SIGN(-5)', grid({}), 'A1')).toBe(-1);
    expect(evaluateFormula('=SIGN(0)', grid({}), 'A1')).toBe(0);
    expect(evaluateFormula('=SIGN(5)', grid({}), 'A1')).toBe(1);
  });
});

describe('PI / RAND / RANDBETWEEN', () => {
  it('PI() ≈ 3.14159', () => {
    const r = evaluateFormula('=PI()', grid({}), 'A1') as number;
    expect(r).toBeCloseTo(Math.PI);
  });
  it('RAND() returns 0..1', () => {
    const r = evaluateFormula('=RAND()', grid({}), 'A1') as number;
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });
  it('RANDBETWEEN(1, 10) returns integer in range', () => {
    const r = evaluateFormula('=RANDBETWEEN(1, 10)', grid({}), 'A1') as number;
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(10);
    expect(Number.isInteger(r)).toBe(true);
  });
});

describe('EVEN / ODD', () => {
  it('EVEN(1.5) = 2', () => {
    expect(evaluateFormula('=EVEN(1.5)', grid({}), 'A1')).toBe(2);
  });
  it('EVEN(3) = 4', () => {
    expect(evaluateFormula('=EVEN(3)', grid({}), 'A1')).toBe(4);
  });
  it('ODD(1.5) = 3', () => {
    expect(evaluateFormula('=ODD(1.5)', grid({}), 'A1')).toBe(3);
  });
  it('ODD(2) = 3', () => {
    expect(evaluateFormula('=ODD(2)', grid({}), 'A1')).toBe(3);
  });
});
