/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

/** Price table: A=sku, B=name, C=price */
const prices = grid({
  A1: 'SKU-1', B1: 'widget',  C1: 10,
  A2: 'SKU-2', B2: 'gadget',  C2: 25,
  A3: 'SKU-3', B3: 'gizmo',   C3: 99,
  A4: 'SKU-4', B4: 'thingy',  C4: 5,
});

describe('XLOOKUP — exact match (default)', () => {
  it('returns value from parallel column', () => {
    expect(evaluateFormula('=XLOOKUP("SKU-2", A1:A4, C1:C4)', prices, 'E1')).toBe(25);
  });

  it('can look up the other direction (reverse column-to-column)', () => {
    expect(evaluateFormula('=XLOOKUP("gizmo", B1:B4, A1:A4)', prices, 'E1')).toBe('SKU-3');
  });

  it('returns fallback when not found', () => {
    expect(evaluateFormula('=XLOOKUP("NOPE", A1:A4, C1:C4, "missing")', prices, 'E1'))
      .toBe('missing');
  });

  it('returns #N/A when not found and no fallback', () => {
    const r = evaluateFormula('=XLOOKUP("NOPE", A1:A4, C1:C4)', prices, 'E1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.NA);
  });

  it('is case-insensitive for text', () => {
    expect(evaluateFormula('=XLOOKUP("sku-1", A1:A4, C1:C4)', prices, 'E1')).toBe(10);
  });
});

describe('XLOOKUP — search modes', () => {
  const sorted = grid({
    A1: 1, A2: 5, A3: 10, A4: 20, A5: 50,
    B1: 'a', B2: 'b', B3: 'c', B4: 'd', B5: 'e',
  });

  it('last-to-first search (search_mode=-1)', () => {
    // duplicate key, want the later one
    const g = grid({
      A1: 'x', A2: 'y', A3: 'x',
      B1: 1,   B2: 2,   B3: 3,
    });
    expect(evaluateFormula('=XLOOKUP("x", A1:A3, B1:B3, "#N/A", 0, -1)', g, 'E1')).toBe(3);
    expect(evaluateFormula('=XLOOKUP("x", A1:A3, B1:B3, "#N/A", 0, 1)', g, 'E1')).toBe(1);
  });

  it('binary search ascending (search_mode=2)', () => {
    expect(evaluateFormula('=XLOOKUP(10, A1:A5, B1:B5, "#N/A", 0, 2)', sorted, 'E1')).toBe('c');
  });
});

describe('XLOOKUP — approximate match modes', () => {
  const tiers = grid({
    A1: 0,   B1: 'F',
    A2: 60,  B2: 'D',
    A3: 70,  B3: 'C',
    A4: 80,  B4: 'B',
    A5: 90,  B5: 'A',
  });

  it('match_mode=-1 (next smaller) for exact miss', () => {
    expect(evaluateFormula('=XLOOKUP(85, A1:A5, B1:B5, "#N/A", -1)', tiers, 'E1')).toBe('B');
  });

  it('match_mode=1 (next larger) for exact miss', () => {
    expect(evaluateFormula('=XLOOKUP(85, A1:A5, B1:B5, "#N/A", 1)', tiers, 'E1')).toBe('A');
  });

  it('match_mode=-1 with binary search sorted-ascending', () => {
    expect(evaluateFormula('=XLOOKUP(85, A1:A5, B1:B5, "#N/A", -1, 2)', tiers, 'E1')).toBe('B');
  });
});

describe('XLOOKUP — wildcards (match_mode=2)', () => {
  const names = grid({
    A1: 'Alice', A2: 'Bob', A3: 'Charlie',
    B1: 1,       B2: 2,     B3: 3,
  });

  it('matches * wildcard', () => {
    expect(evaluateFormula('=XLOOKUP("Al*", A1:A3, B1:B3, "#N/A", 2)', names, 'E1')).toBe(1);
  });

  it('matches ? wildcard', () => {
    expect(evaluateFormula('=XLOOKUP("Bo?", A1:A3, B1:B3, "#N/A", 2)', names, 'E1')).toBe(2);
  });
});

describe('XLOOKUP — horizontal arrays', () => {
  it('searches across a row and returns from a parallel row', () => {
    const g = grid({
      A1: 'q1', B1: 'q2', C1: 'q3', D1: 'q4',
      A2: 100,  B2: 200,  C2: 300,  D2: 400,
    });
    expect(evaluateFormula('=XLOOKUP("q3", A1:D1, A2:D2)', g, 'E1')).toBe(300);
  });
});
