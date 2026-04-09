/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { extractDependencies, detectCircular } from './circular-detect.ts';

describe('extractDependencies', () => {
  it('extracts single cell reference', () => {
    const deps = extractDependencies('=A1');
    expect(deps).toEqual(new Set(['A1']));
  });

  it('extracts multiple cell references', () => {
    const deps = extractDependencies('=A1+B2+C3');
    expect(deps).toEqual(new Set(['A1', 'B2', 'C3']));
  });

  it('expands range references', () => {
    const deps = extractDependencies('=SUM(A1:A3)');
    expect(deps).toEqual(new Set(['A1', 'A2', 'A3']));
  });

  it('expands 2D range references', () => {
    const deps = extractDependencies('=SUM(A1:B2)');
    expect(deps).toEqual(new Set(['A1', 'A2', 'B1', 'B2']));
  });

  it('returns empty set for literals', () => {
    const deps = extractDependencies('=42');
    expect(deps.size).toBe(0);
  });

  it('returns empty set for invalid formula', () => {
    const deps = extractDependencies('=+*invalid');
    expect(deps.size).toBe(0);
  });

  it('extracts deps from nested functions', () => {
    const deps = extractDependencies('=IF(A1>0, SUM(B1:B3), C1)');
    expect(deps).toEqual(new Set(['A1', 'B1', 'B2', 'B3', 'C1']));
  });
});

describe('detectCircular', () => {
  it('detects a direct circular reference', () => {
    const formulas = new Map([
      ['A1', '=B1'],
      ['B1', '=A1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
    expect(circular.has('B1')).toBe(true);
  });

  it('detects a transitive circular reference', () => {
    const formulas = new Map([
      ['A1', '=B1'],
      ['B1', '=C1'],
      ['C1', '=A1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
    expect(circular.has('B1')).toBe(true);
    expect(circular.has('C1')).toBe(true);
  });

  it('does not flag non-circular references', () => {
    const formulas = new Map([
      ['A1', '=B1+C1'],
      ['B1', '=10'],
      ['C1', '=20'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.size).toBe(0);
  });

  it('detects self-referencing cell', () => {
    const formulas = new Map([
      ['A1', '=A1+1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
  });

  it('handles a mix of circular and non-circular', () => {
    const formulas = new Map([
      ['A1', '=B1'],
      ['B1', '=A1'],
      ['C1', '=10'],
      ['D1', '=C1+5'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
    expect(circular.has('B1')).toBe(true);
    expect(circular.has('C1')).toBe(false);
    expect(circular.has('D1')).toBe(false);
  });

  it('detects circular through range references', () => {
    const formulas = new Map([
      ['A1', '=SUM(B1:B3)'],
      ['B2', '=A1'],
    ]);
    const circular = detectCircular(formulas);
    expect(circular.has('A1')).toBe(true);
    expect(circular.has('B2')).toBe(true);
  });
});
