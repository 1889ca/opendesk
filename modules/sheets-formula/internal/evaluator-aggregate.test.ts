/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('AVERAGEIF', () => {
  const g = grid({ A1: 'a', A2: 'b', A3: 'a', B1: 10, B2: 20, B3: 30 });

  it('averages matching values with sum_range', () => {
    expect(evaluateFormula('=AVERAGEIF(A1:A3, "a", B1:B3)', g, 'C1')).toBe(20);
  });

  it('returns #DIV/0! when nothing matches', () => {
    const r = evaluateFormula('=AVERAGEIF(A1:A3, "z", B1:B3)', g, 'C1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });

  it('averages test range when no sum_range', () => {
    const g2 = grid({ A1: 10, A2: 5, A3: 20, A4: 15 });
    expect(evaluateFormula('=AVERAGEIF(A1:A4, ">8")', g2, 'B1')).toBe(15);
  });
});

describe('COUNTIFS', () => {
  const g = grid({
    A1: 'apple', B1: 10,
    A2: 'banana', B2: 20,
    A3: 'apple', B3: 30,
    A4: 'banana', B4: 5,
  });

  it('counts with multiple criteria', () => {
    expect(evaluateFormula('=COUNTIFS(A1:A4, "apple", B1:B4, ">5")', g, 'C1')).toBe(2);
  });

  it('returns 0 when no matches', () => {
    expect(evaluateFormula('=COUNTIFS(A1:A4, "cherry", B1:B4, ">0")', g, 'C1')).toBe(0);
  });
});

describe('SUMIFS', () => {
  const g = grid({
    A1: 100, B1: 'east', C1: 'q1',
    A2: 200, B2: 'west', C2: 'q1',
    A3: 300, B3: 'east', C3: 'q2',
    A4: 400, B4: 'east', C4: 'q1',
  });

  it('sums with multiple criteria', () => {
    expect(evaluateFormula('=SUMIFS(A1:A4, B1:B4, "east", C1:C4, "q1")', g, 'D1')).toBe(500);
  });

  it('returns 0 when no matches', () => {
    expect(evaluateFormula('=SUMIFS(A1:A4, B1:B4, "north", C1:C4, "q1")', g, 'D1')).toBe(0);
  });
});

describe('SUMPRODUCT', () => {
  const g = grid({ A1: 2, A2: 3, A3: 4, B1: 10, B2: 20, B3: 30 });

  it('sums products of corresponding elements', () => {
    // 2*10 + 3*20 + 4*30 = 20 + 60 + 120 = 200
    expect(evaluateFormula('=SUMPRODUCT(A1:A3, B1:B3)', g, 'C1')).toBe(200);
  });

  it('works with single array', () => {
    expect(evaluateFormula('=SUMPRODUCT(A1:A3)', g, 'C1')).toBe(9);
  });

  it('errors on mismatched sizes', () => {
    const r = evaluateFormula('=SUMPRODUCT(A1:A3, B1:B2)', g, 'C1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('HLOOKUP', () => {
  const g = grid({
    A1: 'name', B1: 'age', C1: 'city',
    A2: 'Alice', B2: 25, C2: 'NYC',
    A3: 'Bob', B3: 30, C3: 'LA',
  });

  it('finds value by column header', () => {
    expect(evaluateFormula('=HLOOKUP("age", A1:C3, 2, FALSE)', g, 'D1')).toBe(25);
  });

  it('returns #N/A when not found', () => {
    const r = evaluateFormula('=HLOOKUP("zip", A1:C3, 2, FALSE)', g, 'D1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });
});

describe('CHOOSE', () => {
  it('returns nth value', () => {
    expect(evaluateFormula('=CHOOSE(2, "a", "b", "c")', grid({}), 'A1')).toBe('b');
  });

  it('returns #VALUE! for out-of-range index', () => {
    const r = evaluateFormula('=CHOOSE(5, "a", "b")', grid({}), 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });

  it('works with cell references', () => {
    const g = grid({ A1: 1, B1: 100, C1: 200, D1: 300 });
    expect(evaluateFormula('=CHOOSE(A1, B1, C1, D1)', g, 'E1')).toBe(100);
  });
});

describe('combined — real-world formula patterns', () => {
  it('IFERROR + VLOOKUP pattern', () => {
    const g = grid({ A1: 1, B1: 'found', A2: 2, B2: 'also found' });
    expect(evaluateFormula('=IFERROR(VLOOKUP(99, A1:B2, 2, FALSE), "missing")', g, 'C1')).toBe('missing');
    expect(evaluateFormula('=IFERROR(VLOOKUP(1, A1:B2, 2, FALSE), "missing")', g, 'C1')).toBe('found');
  });

  it('INDEX + MATCH pattern', () => {
    const g = grid({
      A1: 'Alice', B1: 100,
      A2: 'Bob', B2: 200,
      A3: 'Carol', B3: 300,
    });
    expect(evaluateFormula('=INDEX(B1:B3, MATCH("Bob", A1:A3, 0))', g, 'C1')).toBe(200);
  });

  it('nested IF + AND', () => {
    const g = grid({ A1: 85 });
    const formula = '=IF(AND(A1>=80, A1<90), "B", IF(A1>=90, "A", "C"))';
    expect(evaluateFormula(formula, g, 'B1')).toBe('B');
  });
});
