/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

/**
 * Test fixture: a small sales ledger.
 *   A: region    B: product    C: qty    D: revenue
 * Row 1: header names (strings)
 * Rows 2–6: data
 */
const ledger = grid({
  A1: 'region', B1: 'product', C1: 'qty',  D1: 'revenue',
  A2: 'east',   B2: 'apple',   C2: 10,     D2: 100,
  A3: 'east',   B3: 'pear',    C3: 5,      D3: 60,
  A4: 'west',   B4: 'apple',   C4: 8,      D4: 72,
  A5: 'west',   B5: 'apple',   C5: 12,     D5: 144,
  A6: 'north',  B6: 'pear',    C6: 3,      D6: 30,
});

describe('COUNTIFS', () => {
  it('counts rows matching a single criterion', () => {
    expect(evaluateFormula('=COUNTIFS(A2:A6, "east")', ledger, 'E1')).toBe(2);
  });

  it('counts rows matching multiple criteria', () => {
    expect(evaluateFormula('=COUNTIFS(A2:A6, "west", B2:B6, "apple")', ledger, 'E1')).toBe(2);
  });

  it('counts rows with numeric comparison criteria', () => {
    expect(evaluateFormula('=COUNTIFS(C2:C6, ">=8")', ledger, 'E1')).toBe(3);
  });

  it('returns #VALUE! on mismatched ranges', () => {
    const r = evaluateFormula('=COUNTIFS(A2:A6, "east", B2:B4, "apple")', ledger, 'E1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('SUMIFS', () => {
  it('sums values meeting all criteria', () => {
    expect(evaluateFormula('=SUMIFS(D2:D6, A2:A6, "west", B2:B6, "apple")', ledger, 'E1'))
      .toBe(216);
  });

  it('sums with a single criterion', () => {
    expect(evaluateFormula('=SUMIFS(D2:D6, A2:A6, "east")', ledger, 'E1')).toBe(160);
  });

  it('handles numeric threshold criteria', () => {
    expect(evaluateFormula('=SUMIFS(D2:D6, C2:C6, ">=10")', ledger, 'E1')).toBe(244);
  });

  it('returns 0 when nothing matches', () => {
    expect(evaluateFormula('=SUMIFS(D2:D6, A2:A6, "south")', ledger, 'E1')).toBe(0);
  });
});

describe('AVERAGEIF / AVERAGEIFS', () => {
  it('AVERAGEIF averages matching cells in same range', () => {
    expect(evaluateFormula('=AVERAGEIF(D2:D6, ">=100")', ledger, 'E1')).toBe(122);
  });

  it('AVERAGEIF with separate average_range', () => {
    expect(evaluateFormula('=AVERAGEIF(A2:A6, "east", D2:D6)', ledger, 'E1')).toBe(80);
  });

  it('AVERAGEIFS with multiple criteria', () => {
    expect(evaluateFormula('=AVERAGEIFS(D2:D6, A2:A6, "west", B2:B6, "apple")', ledger, 'E1'))
      .toBe(108);
  });

  it('AVERAGEIF returns #DIV/0! with no matches', () => {
    const r = evaluateFormula('=AVERAGEIF(A2:A6, "south", D2:D6)', ledger, 'E1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.DIV0);
  });
});

describe('MAXIFS / MINIFS', () => {
  it('MAXIFS returns largest matching value', () => {
    expect(evaluateFormula('=MAXIFS(D2:D6, B2:B6, "apple")', ledger, 'E1')).toBe(144);
  });

  it('MINIFS returns smallest matching value', () => {
    expect(evaluateFormula('=MINIFS(D2:D6, B2:B6, "apple")', ledger, 'E1')).toBe(72);
  });

  it('MAXIFS with no matches returns 0', () => {
    expect(evaluateFormula('=MAXIFS(D2:D6, A2:A6, "south")', ledger, 'E1')).toBe(0);
  });
});

describe('wildcards in criteria', () => {
  it('* matches substrings', () => {
    expect(evaluateFormula('=COUNTIFS(B2:B6, "ap*")', ledger, 'E1')).toBe(3);
  });

  it('? matches single character', () => {
    expect(evaluateFormula('=COUNTIFS(B2:B6, "pea?")', ledger, 'E1')).toBe(2);
  });
});
