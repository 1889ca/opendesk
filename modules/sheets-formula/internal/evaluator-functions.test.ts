/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

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

describe('evaluator — COUNTIF', () => {
  const g = grid({ A1: 10, A2: 20, A3: 30, A4: 20, A5: 'hello' });

  it('counts exact numeric match', () => {
    expect(evaluateFormula('=COUNTIF(A1:A5, 20)', g, 'B1')).toBe(2);
  });

  it('counts with > operator', () => {
    expect(evaluateFormula('=COUNTIF(A1:A4, ">15")', g, 'B1')).toBe(3);
  });

  it('counts with <> operator', () => {
    expect(evaluateFormula('=COUNTIF(A1:A4, "<>20")', g, 'B1')).toBe(2);
  });

  it('counts string match', () => {
    expect(evaluateFormula('=COUNTIF(A1:A5, "hello")', g, 'B1')).toBe(1);
  });
});

describe('evaluator — SUMIF', () => {
  const g = grid({ A1: 'a', A2: 'b', A3: 'a', B1: 10, B2: 20, B3: 30 });

  it('sums with matching criteria and sum_range', () => {
    expect(evaluateFormula('=SUMIF(A1:A3, "a", B1:B3)', g, 'C1')).toBe(40);
  });

  it('sums range itself when no sum_range given', () => {
    const g2 = grid({ A1: 10, A2: 5, A3: 20 });
    expect(evaluateFormula('=SUMIF(A1:A3, ">8")', g2, 'B1')).toBe(30);
  });
});

describe('evaluator — INDEX', () => {
  const g = grid({ A1: 'apple', A2: 'banana', A3: 'cherry', B1: 1, B2: 2, B3: 3 });

  it('returns value at row in single-column range', () => {
    expect(evaluateFormula('=INDEX(A1:A3, 2)', g, 'C1')).toBe('banana');
  });

  it('returns value at row/col in multi-column range', () => {
    expect(evaluateFormula('=INDEX(A1:B3, 3, 2)', g, 'C1')).toBe(3);
  });

  it('returns #REF! for out-of-bounds', () => {
    const result = evaluateFormula('=INDEX(A1:A3, 99)', g, 'C1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.REF);
  });
});

describe('evaluator — MATCH', () => {
  const g = grid({ A1: 10, A2: 20, A3: 30 });

  it('exact match returns 1-based position', () => {
    expect(evaluateFormula('=MATCH(20, A1:A3, 0)', g, 'B1')).toBe(2);
  });

  it('returns #N/A when no exact match', () => {
    const result = evaluateFormula('=MATCH(99, A1:A3, 0)', g, 'B1') as FormulaError;
    expect(result.error).toBe(FormulaErrorType.NA);
  });
});

describe('evaluator — DATE / DATEDIF', () => {
  it('DATE returns Excel serial number', () => {
    // 2024-01-01 = serial 45292
    const result = evaluateFormula('=DATE(2024, 1, 1)', grid({}), 'A1') as number;
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('DATEDIF in days', () => {
    // DATE(2024,1,1) and DATE(2024,1,11) should differ by 10 days
    const g = grid({ A1: 45292, A2: 45302 }); // approx serial dates
    const result = evaluateFormula('=DATEDIF(A1, A2, "D")', g, 'B1') as number;
    expect(result).toBe(10);
  });
});

describe('evaluator — FLOOR / CEILING', () => {
  it('FLOOR with no significance', () => {
    expect(evaluateFormula('=FLOOR(3.7)', grid({}), 'A1')).toBe(3);
  });

  it('FLOOR with significance', () => {
    expect(evaluateFormula('=FLOOR(7, 3)', grid({}), 'A1')).toBe(6);
  });

  it('CEILING with no significance', () => {
    expect(evaluateFormula('=CEILING(3.2)', grid({}), 'A1')).toBe(4);
  });

  it('CEILING with significance', () => {
    expect(evaluateFormula('=CEILING(7, 3)', grid({}), 'A1')).toBe(9);
  });
});

describe('evaluator — CONCAT', () => {
  it('concatenates multiple values', () => {
    const g = grid({ A1: 'Hello', B1: ' ', C1: 'World' });
    expect(evaluateFormula('=CONCAT(A1, B1, C1)', g, 'D1')).toBe('Hello World');
  });
});
