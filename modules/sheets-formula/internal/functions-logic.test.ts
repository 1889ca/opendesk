/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

const empty = grid({});

describe('AND', () => {
  it('returns true when all args truthy', () => {
    expect(evaluateFormula('=AND(TRUE, TRUE)', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=AND(1, 2, 3)', empty, 'A1')).toBe(true);
  });
  it('returns false when any arg falsy', () => {
    expect(evaluateFormula('=AND(TRUE, FALSE)', empty, 'A1')).toBe(false);
    expect(evaluateFormula('=AND(1, 0)', empty, 'A1')).toBe(false);
  });
  it('propagates errors', () => {
    const g: CellGrid = new Map([['A1', { type: 'error' as const, error: FormulaErrorType.NA, message: '' }]]);
    const r = evaluateFormula('=AND(A1, TRUE)', g, 'B1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });
});

describe('OR', () => {
  it('returns true when any arg truthy', () => {
    expect(evaluateFormula('=OR(FALSE, TRUE)', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=OR(0, 1)', empty, 'A1')).toBe(true);
  });
  it('returns false when all args falsy', () => {
    expect(evaluateFormula('=OR(FALSE, 0)', empty, 'A1')).toBe(false);
  });
});

describe('NOT', () => {
  it('negates TRUE to FALSE', () => {
    expect(evaluateFormula('=NOT(TRUE)', empty, 'A1')).toBe(false);
  });
  it('negates 0 to TRUE', () => {
    expect(evaluateFormula('=NOT(0)', empty, 'A1')).toBe(true);
  });
});

describe('XOR', () => {
  it('returns true for odd number of TRUE args', () => {
    expect(evaluateFormula('=XOR(TRUE, FALSE)', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=XOR(TRUE, TRUE, TRUE)', empty, 'A1')).toBe(true);
  });
  it('returns false for even number of TRUE args', () => {
    expect(evaluateFormula('=XOR(TRUE, TRUE)', empty, 'A1')).toBe(false);
  });
});

describe('IFERROR', () => {
  it('returns value if no error', () => {
    expect(evaluateFormula('=IFERROR(42, "err")', empty, 'A1')).toBe(42);
  });
  it('returns fallback on error', () => {
    expect(evaluateFormula('=IFERROR(1/0, "div zero")', empty, 'A1')).toBe('div zero');
  });
});

describe('IFNA', () => {
  it('returns value if not #N/A', () => {
    expect(evaluateFormula('=IFNA(42, "na")', empty, 'A1')).toBe(42);
  });
  it('returns fallback for #N/A only', () => {
    const g = grid({ A1: 1, A2: 2, A3: 3 });
    const result = evaluateFormula('=IFNA(MATCH(99, A1:A3, 0), "not found")', g, 'B1');
    expect(result).toBe('not found');
  });
  it('does not catch non-NA errors', () => {
    const r = evaluateFormula('=IFNA(1/0, "nope")', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });
});

describe('IS* functions', () => {
  it('ISBLANK detects null/empty', () => {
    expect(evaluateFormula('=ISBLANK(A1)', grid({}), 'B1')).toBe(true);
    expect(evaluateFormula('=ISBLANK(A1)', grid({ A1: 5 }), 'B1')).toBe(false);
  });
  it('ISERROR detects errors', () => {
    expect(evaluateFormula('=ISERROR(1/0)', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=ISERROR(42)', empty, 'A1')).toBe(false);
  });
  it('ISNA detects only #N/A', () => {
    const g = grid({ A1: 1 });
    expect(evaluateFormula('=ISNA(MATCH(99, A1:A1, 0))', g, 'B1')).toBe(true);
  });
  it('ISNUMBER', () => {
    expect(evaluateFormula('=ISNUMBER(42)', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=ISNUMBER("hello")', empty, 'A1')).toBe(false);
  });
  it('ISTEXT', () => {
    expect(evaluateFormula('=ISTEXT("hello")', empty, 'A1')).toBe(true);
    expect(evaluateFormula('=ISTEXT(42)', empty, 'A1')).toBe(false);
  });
});
