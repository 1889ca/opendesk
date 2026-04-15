/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, isFormulaError, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

describe('AND / OR / NOT / XOR', () => {
  it('AND returns TRUE when all truthy', () => {
    expect(evaluateFormula('=AND(TRUE, 1, "TRUE")', grid({}), 'A1')).toBe(true);
  });

  it('AND returns FALSE on any falsy', () => {
    expect(evaluateFormula('=AND(TRUE, FALSE, TRUE)', grid({}), 'A1')).toBe(false);
  });

  it('AND over a range skips empty cells', () => {
    const g = grid({ A1: true, A2: null, A3: true });
    expect(evaluateFormula('=AND(A1:A3)', g, 'B1')).toBe(true);
  });

  it('OR returns TRUE when any truthy', () => {
    expect(evaluateFormula('=OR(FALSE, 0, 1)', grid({}), 'A1')).toBe(true);
  });

  it('OR returns FALSE when all falsy', () => {
    expect(evaluateFormula('=OR(0, FALSE, "")', grid({}), 'A1')).toBe(false);
  });

  it('NOT flips booleans', () => {
    expect(evaluateFormula('=NOT(TRUE)', grid({}), 'A1')).toBe(false);
    expect(evaluateFormula('=NOT(0)', grid({}), 'A1')).toBe(true);
  });

  it('XOR returns TRUE for odd truthy count', () => {
    expect(evaluateFormula('=XOR(TRUE, TRUE, TRUE)', grid({}), 'A1')).toBe(true);
    expect(evaluateFormula('=XOR(TRUE, TRUE)', grid({}), 'A1')).toBe(false);
    expect(evaluateFormula('=XOR(TRUE, FALSE, FALSE)', grid({}), 'A1')).toBe(true);
  });
});

describe('IFERROR / IFNA', () => {
  it('IFERROR substitutes on any error', () => {
    expect(evaluateFormula('=IFERROR(1/0, "n/a")', grid({}), 'A1')).toBe('n/a');
  });

  it('IFERROR passes through non-error values', () => {
    expect(evaluateFormula('=IFERROR(42, "n/a")', grid({}), 'A1')).toBe(42);
  });

  it('IFNA substitutes only on #N/A', () => {
    const g = grid({ A1: 'needle', A2: 'hay' });
    expect(evaluateFormula('=IFNA(VLOOKUP("missing", A1:A2, 1, FALSE), "fallback")', g, 'B1'))
      .toBe('fallback');
  });

  it('IFNA passes through non-#N/A errors', () => {
    const result = evaluateFormula('=IFNA(1/0, "fallback")', grid({}), 'A1') as FormulaError;
    expect(isFormulaError(result)).toBe(true);
    expect(result.error).toBe(FormulaErrorType.DIV0);
  });
});

describe('IFS / SWITCH', () => {
  it('IFS returns first matching branch', () => {
    const g = grid({ A1: 75 });
    expect(evaluateFormula('=IFS(A1>=90, "A", A1>=80, "B", A1>=70, "C", TRUE, "F")', g, 'B1'))
      .toBe('C');
  });

  it('IFS returns #N/A when nothing matches', () => {
    const g = grid({ A1: 5 });
    const r = evaluateFormula('=IFS(A1>10, "big", A1>6, "mid")', g, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });

  it('SWITCH matches exact value and returns paired value', () => {
    const g = grid({ A1: 'blue' });
    expect(evaluateFormula('=SWITCH(A1, "red", 1, "blue", 2, "green", 3, 0)', g, 'B1')).toBe(2);
  });

  it('SWITCH returns default when nothing matches', () => {
    const g = grid({ A1: 'purple' });
    expect(evaluateFormula('=SWITCH(A1, "red", 1, "blue", 2, -1)', g, 'B1')).toBe(-1);
  });

  it('SWITCH returns #N/A when no match and no default', () => {
    const g = grid({ A1: 'x' });
    const r = evaluateFormula('=SWITCH(A1, "a", 1, "b", 2)', g, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });
});

describe('IS* predicates', () => {
  it('ISERROR detects errors', () => {
    expect(evaluateFormula('=ISERROR(1/0)', grid({}), 'A1')).toBe(true);
    expect(evaluateFormula('=ISERROR(1)', grid({}), 'A1')).toBe(false);
  });

  it('ISNUMBER / ISTEXT / ISBLANK', () => {
    const g = grid({ A1: 42, B1: 'hi', C1: null });
    expect(evaluateFormula('=ISNUMBER(A1)', g, 'Z1')).toBe(true);
    expect(evaluateFormula('=ISTEXT(B1)', g, 'Z1')).toBe(true);
    expect(evaluateFormula('=ISBLANK(C1)', g, 'Z1')).toBe(true);
    expect(evaluateFormula('=ISBLANK(A1)', g, 'Z1')).toBe(false);
  });

  it('ISLOGICAL checks booleans', () => {
    expect(evaluateFormula('=ISLOGICAL(TRUE)', grid({}), 'A1')).toBe(true);
    expect(evaluateFormula('=ISLOGICAL(1)', grid({}), 'A1')).toBe(false);
  });
});

describe('TRUE() / FALSE()', () => {
  it('return the corresponding boolean', () => {
    expect(evaluateFormula('=TRUE()', grid({}), 'A1')).toBe(true);
    expect(evaluateFormula('=FALSE()', grid({}), 'A1')).toBe(false);
  });
});
