/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { evaluateFormula, FormulaErrorType } from '../index.ts';
import type { CellGrid, FormulaError } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('evaluator — VLOOKUP', () => {
  const g = grid({
    A1: 1, B1: 'apple',  C1: 1.00,
    A2: 2, B2: 'banana', C2: 2.50,
    A3: 3, B3: 'cherry', C3: 3.75,
    A4: 4, B4: 'date',   C4: 4.00,
  });

  it('finds exact match', () => {
    expect(evaluateFormula('=VLOOKUP(2, A1:C4, 2, FALSE)', g, 'D1')).toBe('banana');
  });

  it('returns value from specified column', () => {
    expect(evaluateFormula('=VLOOKUP(3, A1:C4, 3, FALSE)', g, 'D1')).toBe(3.75);
  });

  it('returns #N/A when no match found', () => {
    const result = evaluateFormula('=VLOOKUP(99, A1:C4, 2, FALSE)', g, 'D1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.NA);
  });

  it('returns #REF! for out-of-range column', () => {
    const result = evaluateFormula('=VLOOKUP(1, A1:C4, 5, FALSE)', g, 'D1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.REF);
  });
});

describe('evaluator — text functions', () => {
  const g = grid({ A1: 'Hello World' });

  it('LEN', () => { expect(evaluateFormula('=LEN(A1)', g, 'B1')).toBe(11); });
  it('LEFT', () => { expect(evaluateFormula('=LEFT(A1, 5)', g, 'B1')).toBe('Hello'); });
  it('RIGHT', () => { expect(evaluateFormula('=RIGHT(A1, 5)', g, 'B1')).toBe('World'); });
  it('MID', () => { expect(evaluateFormula('=MID(A1, 7, 5)', g, 'B1')).toBe('World'); });
  it('TRIM', () => {
    expect(evaluateFormula('=TRIM(A1)', grid({ A1: '  hello   world  ' }), 'B1')).toBe('hello world');
  });
  it('UPPER', () => { expect(evaluateFormula('=UPPER(A1)', g, 'B1')).toBe('HELLO WORLD'); });
  it('LOWER', () => { expect(evaluateFormula('=LOWER(A1)', g, 'B1')).toBe('hello world'); });
});

describe('evaluator — empty/missing cells', () => {
  it('missing cells = 0 in numeric context', () => {
    expect(evaluateFormula('=A1+Z99', grid({ A1: 10 }), 'B1')).toBe(10);
  });

  it('missing cells = "" in CONCATENATE', () => {
    expect(evaluateFormula('=CONCATENATE(A1, B1)', grid({ A1: 'hello' }), 'C1')).toBe('hello');
  });

  it('SUM ignores missing cells in range', () => {
    expect(evaluateFormula('=SUM(A1:A3)', grid({ A1: 10, A3: 30 }), 'B1')).toBe(40);
  });
});

describe('evaluator — error propagation', () => {
  it('propagates errors through arithmetic', () => {
    const g: CellGrid = new Map([
      ['A1', { type: 'error' as const, error: FormulaErrorType.DIV0, message: 'test' }],
    ]);
    const result = evaluateFormula('=A1+1', g, 'B1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.DIV0);
  });

  it('#NAME? for unknown functions', () => {
    const result = evaluateFormula('=FAKEFUNC(1)', grid({}), 'A1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.NAME);
  });

  it('#VALUE! for invalid formulas', () => {
    const result = evaluateFormula('=+*invalid', grid({}), 'A1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('evaluator — complex formulas', () => {
  it('subtotal * tax rate', () => {
    const g = grid({ A1: 100, A2: 200, A3: 300, B1: 0.08 });
    expect(evaluateFormula('=SUM(A1:A3)*B1', g, 'C1')).toBe(48);
  });

  it('nested functions with arithmetic', () => {
    const g = grid({ A1: 10, A2: 20, A3: 30 });
    expect(evaluateFormula('=ROUND(AVERAGE(A1:A3)*1.1, 1)', g, 'B1')).toBe(22);
  });
});
