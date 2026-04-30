/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

const nums = grid({ A1: 10, A2: 20, A3: 30, A4: 40, A5: 50 });

describe('MEDIAN', () => {
  it('returns middle value for odd count', () => {
    expect(evaluateFormula('=MEDIAN(A1:A5)', nums, 'B1')).toBe(30);
  });
  it('returns average of middle two for even count', () => {
    const g = grid({ A1: 10, A2: 20, A3: 30, A4: 40 });
    expect(evaluateFormula('=MEDIAN(A1:A4)', g, 'B1')).toBe(25);
  });
  it('returns #NUM! for no values', () => {
    const r = evaluateFormula('=MEDIAN(A1:A1)', grid({}), 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('STDEV / STDEVP', () => {
  it('STDEV computes sample standard deviation', () => {
    const g = grid({ A1: 2, A2: 4, A3: 4, A4: 4, A5: 5, A6: 5, A7: 7, A8: 9 });
    const result = evaluateFormula('=STDEV(A1:A8)', g, 'B1') as number;
    expect(result).toBeCloseTo(2.0, 0);
  });
  it('STDEVP computes population standard deviation', () => {
    const g = grid({ A1: 2, A2: 4, A3: 4, A4: 4, A5: 5, A6: 5, A7: 7, A8: 9 });
    const result = evaluateFormula('=STDEVP(A1:A8)', g, 'B1') as number;
    expect(result).toBeCloseTo(2.0, 0);
  });
  it('STDEV requires >= 2 values', () => {
    const r = evaluateFormula('=STDEV(A1:A1)', grid({ A1: 5 }), 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });
});

describe('VAR / VARP', () => {
  it('VAR computes sample variance', () => {
    const g = grid({ A1: 1, A2: 2, A3: 3 });
    expect(evaluateFormula('=VAR(A1:A3)', g, 'B1')).toBe(1);
  });
  it('VARP computes population variance', () => {
    const g = grid({ A1: 1, A2: 2, A3: 3 });
    const result = evaluateFormula('=VARP(A1:A3)', g, 'B1') as number;
    expect(result).toBeCloseTo(2 / 3, 5);
  });
});

describe('LARGE / SMALL', () => {
  it('LARGE returns kth largest', () => {
    expect(evaluateFormula('=LARGE(A1:A5, 1)', nums, 'B1')).toBe(50);
    expect(evaluateFormula('=LARGE(A1:A5, 3)', nums, 'B1')).toBe(30);
  });
  it('SMALL returns kth smallest', () => {
    expect(evaluateFormula('=SMALL(A1:A5, 1)', nums, 'B1')).toBe(10);
    expect(evaluateFormula('=SMALL(A1:A5, 2)', nums, 'B1')).toBe(20);
  });
  it('returns #NUM! for out-of-range k', () => {
    const r = evaluateFormula('=LARGE(A1:A5, 99)', nums, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NUM);
  });
});

describe('COUNTA / COUNTBLANK', () => {
  const g = grid({ A1: 'hello', A2: 42, A3: null, A4: '', A5: true });
  it('COUNTA counts non-blank cells', () => {
    expect(evaluateFormula('=COUNTA(A1:A5)', g, 'B1')).toBe(3);
  });
  it('COUNTBLANK counts blank cells', () => {
    expect(evaluateFormula('=COUNTBLANK(A1:A5)', g, 'B1')).toBe(2);
  });
});

describe('MODE', () => {
  it('returns most frequent value', () => {
    const g = grid({ A1: 1, A2: 2, A3: 2, A4: 3, A5: 3, A6: 3 });
    expect(evaluateFormula('=MODE(A1:A6)', g, 'B1')).toBe(3);
  });
  it('returns #N/A when no repeats', () => {
    const g = grid({ A1: 1, A2: 2, A3: 3 });
    const r = evaluateFormula('=MODE(A1:A3)', g, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });
});

describe('PRODUCT', () => {
  it('multiplies all values', () => {
    const g = grid({ A1: 2, A2: 3, A3: 4 });
    expect(evaluateFormula('=PRODUCT(A1:A3)', g, 'B1')).toBe(24);
  });
  it('returns 0 for empty range', () => {
    expect(evaluateFormula('=PRODUCT(A1:A3)', grid({}), 'B1')).toBe(0);
  });
});
