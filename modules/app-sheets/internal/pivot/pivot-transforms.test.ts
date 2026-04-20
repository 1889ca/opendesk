/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { buildPivot } from './pivot-engine.ts';
import { applyDisplayMode } from './pivot-transforms.ts';

const HEADERS = ['Region', 'Product', 'Sales'];
const DATA: string[][] = [
  ['East', 'Widget', '100'],
  ['East', 'Gadget', '200'],
  ['West', 'Widget', '150'],
  ['West', 'Gadget', '300'],
];

function makePivot() {
  return buildPivot({
    rowFields: [0],
    colFields: [1],
    valueFields: [{ fieldIndex: 2, aggregation: 'SUM' }],
    dataRows: DATA,
    headers: HEADERS,
  });
}

function cellVal(
  result: ReturnType<typeof buildPivot>,
  rowLabel: string,
  colLabel: string,
): number | null {
  const rk = result.rowKeys.find((k) => k[0] === rowLabel)!;
  const ck = result.colKeys.find((k) => k[0] === colLabel)!;
  return (
    result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`)?.[0] ?? null
  );
}

describe('applyDisplayMode — pct_row', () => {
  it('converts values to percentage of row total', () => {
    const result = applyDisplayMode(makePivot(), 0, 'pct_row');
    const val = cellVal(result, 'East', 'Widget');
    expect(val).toBeCloseTo(33.33, 1);
  });

  it('row percentages sum to ~100', () => {
    const result = applyDisplayMode(makePivot(), 0, 'pct_row');
    const w = cellVal(result, 'East', 'Widget')!;
    const g = cellVal(result, 'East', 'Gadget')!;
    expect(w + g).toBeCloseTo(100, 1);
  });
});

describe('applyDisplayMode — pct_col', () => {
  it('converts values to percentage of column total', () => {
    const result = applyDisplayMode(makePivot(), 0, 'pct_col');
    const val = cellVal(result, 'East', 'Widget');
    expect(val).toBeCloseTo(40, 1);
  });
});

describe('applyDisplayMode — pct_grand', () => {
  it('converts values to percentage of grand total', () => {
    const result = applyDisplayMode(makePivot(), 0, 'pct_grand');
    const val = cellVal(result, 'East', 'Widget');
    expect(val).toBeCloseTo(13.33, 1);
  });

  it('all percentages sum to 100', () => {
    const result = applyDisplayMode(makePivot(), 0, 'pct_grand');
    let sum = 0;
    for (const rk of result.rowKeys) {
      for (const ck of result.colKeys) {
        const key = `${rk.join('\x00')}|||${ck.join('\x00')}`;
        sum += result.cells.get(key)?.[0] ?? 0;
      }
    }
    expect(sum).toBeCloseTo(100, 1);
  });
});

describe('applyDisplayMode — rank', () => {
  it('rank_asc assigns 1 to smallest in row', () => {
    const result = applyDisplayMode(makePivot(), 0, 'rank_asc');
    expect(cellVal(result, 'East', 'Widget')).toBe(1);
    expect(cellVal(result, 'East', 'Gadget')).toBe(2);
  });

  it('rank_desc assigns 1 to largest in row', () => {
    const result = applyDisplayMode(makePivot(), 0, 'rank_desc');
    expect(cellVal(result, 'East', 'Widget')).toBe(2);
    expect(cellVal(result, 'East', 'Gadget')).toBe(1);
  });
});

describe('applyDisplayMode — running_total', () => {
  it('accumulates values across columns for a row', () => {
    const result = applyDisplayMode(makePivot(), 0, 'running_total');
    const raw = makePivot();
    const colOrder = raw.colKeys;
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;

    const first = result.cells.get(
      `${rk.join('\x00')}|||${colOrder[0].join('\x00')}`,
    )?.[0];
    const second = result.cells.get(
      `${rk.join('\x00')}|||${colOrder[1].join('\x00')}`,
    )?.[0];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second! - first!).toBeGreaterThan(0);
  });
});

describe('applyDisplayMode — value (noop)', () => {
  it('returns the same result unchanged', () => {
    const pivot = makePivot();
    const result = applyDisplayMode(pivot, 0, 'value');
    expect(result).toBe(pivot);
  });
});

describe('applyDisplayMode — null cells', () => {
  it('leaves null cells unchanged', () => {
    const pivot = buildPivot({
      rowFields: [0],
      colFields: [1],
      valueFields: [{ fieldIndex: 2, aggregation: 'SUM' }],
      dataRows: [
        ['A', 'X', '10'],
        ['B', 'Y', '20'],
      ],
      headers: ['Row', 'Col', 'Val'],
    });
    const result = applyDisplayMode(pivot, 0, 'pct_grand');
    const rk = result.rowKeys.find((k) => k[0] === 'A')!;
    const ck = result.colKeys.find((k) => k[0] === 'Y')!;
    const val = result.cells.get(
      `${rk.join('\x00')}|||${ck.join('\x00')}`,
    )?.[0];
    expect(val).toBeNull();
  });
});
