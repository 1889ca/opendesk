/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { buildPivot, type PivotConfig } from './pivot-engine.ts';

const HEADERS = ['Region', 'Product', 'Sales'];
const DATA: string[][] = [
  ['East', 'Widget', '100'],
  ['East', 'Gadget', '200'],
  ['West', 'Widget', '150'],
  ['West', 'Widget', '50'],
  ['West', 'Gadget', '300'],
  ['East', 'Widget', '75'],
];

function makeConfig(overrides: Partial<PivotConfig> = {}): PivotConfig {
  return {
    rowFields: [0],
    colFields: [1],
    valueFields: [{ fieldIndex: 2, aggregation: 'SUM' }],
    dataRows: DATA,
    headers: HEADERS,
    ...overrides,
  };
}

function cellVal(r: ReturnType<typeof buildPivot>, row: string, col: string): number | null {
  const rk = r.rowKeys.find((k) => k[0] === row)!;
  const ck = r.colKeys.find((k) => k[0] === col)!;
  return r.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`)?.[0] ?? null;
}
function cellKey(r: ReturnType<typeof buildPivot>, row: string, col: string): string {
  const rk = r.rowKeys.find((k) => k[0] === row)!;
  const ck = r.colKeys.find((k) => k[0] === col)!;
  return `${rk.join('\x00')}|||${ck.join('\x00')}`;
}

describe('buildPivot — SUM', () => {
  it('produces correct row and column keys', () => {
    const result = buildPivot(makeConfig());
    expect(result.rowKeys.map((k) => k[0])).toContain('East');
    expect(result.rowKeys.map((k) => k[0])).toContain('West');
    expect(result.colKeys.map((k) => k[0])).toContain('Widget');
    expect(result.colKeys.map((k) => k[0])).toContain('Gadget');
  });

  it('sums East-Widget correctly', () => {
    expect(cellVal(buildPivot(makeConfig()), 'East', 'Widget')).toBe(175);
  });

  it('sums West-Widget correctly', () => {
    expect(cellVal(buildPivot(makeConfig()), 'West', 'Widget')).toBe(200);
  });

  it('computes row totals correctly for East', () => {
    const result = buildPivot(makeConfig());
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    expect(result.rowTotals.get(rk.join('\x00'))?.[0]).toBe(375);
  });

  it('computes column totals correctly for Widget', () => {
    const result = buildPivot(makeConfig());
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    expect(result.colTotals.get(ck.join('\x00'))?.[0]).toBe(375);
  });

  it('computes grand total', () => {
    expect(buildPivot(makeConfig()).grandTotal[0]).toBe(875);
  });
});

describe('buildPivot — COUNT', () => {
  it('counts rows per group', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'COUNT' }],
    }));
    expect(cellVal(result, 'West', 'Widget')).toBe(2);
  });

  it('grand total equals row count', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'COUNT' }],
    }));
    expect(result.grandTotal[0]).toBe(DATA.length);
  });
});

describe('buildPivot — AVERAGE', () => {
  it('averages East-Widget correctly', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'AVERAGE' }],
    }));
    expect(cellVal(result, 'East', 'Widget')).toBe(87.5);
  });
});

describe('buildPivot — MIN/MAX', () => {
  it('MIN: West-Widget = 50', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'MIN' }],
    }));
    expect(cellVal(result, 'West', 'Widget')).toBe(50);
  });

  it('MAX: West-Widget = 150', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'MAX' }],
    }));
    expect(cellVal(result, 'West', 'Widget')).toBe(150);
  });
});

describe('buildPivot — new aggregations', () => {
  it('MEDIAN computes correctly', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'MEDIAN' }],
    }));
    expect(cellVal(result, 'West', 'Widget')).toBe(100);
  });

  it('PRODUCT computes correctly', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'PRODUCT' }],
    }));
    expect(cellVal(result, 'East', 'Widget')).toBe(7500);
  });

  it('COUNT_DISTINCT counts unique values', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'COUNT_DISTINCT' }],
    }));
    expect(cellVal(result, 'West', 'Widget')).toBe(2);
    expect(cellVal(result, 'East', 'Gadget')).toBe(1);
  });

  it('STDEV computes sample standard deviation', () => {
    const result = buildPivot(makeConfig({
      valueFields: [{ fieldIndex: 2, aggregation: 'STDEV' }],
    }));
    const val = cellVal(result, 'West', 'Widget');
    expect(val).toBeCloseTo(70.71, 1);
  });
});

describe('buildPivot — multi-value fields', () => {
  it('aggregates multiple value fields independently', () => {
    const vfs = [{ fieldIndex: 2, aggregation: 'SUM' as const }, { fieldIndex: 2, aggregation: 'COUNT' as const }];
    const result = buildPivot(makeConfig({ valueFields: vfs }));
    const vals = result.cells.get(cellKey(result, 'East', 'Widget'));
    expect(vals?.[0]).toBe(175);
    expect(vals?.[1]).toBe(2);
  });

  it('row totals have correct length per value field', () => {
    const vfs = [{ fieldIndex: 2, aggregation: 'SUM' as const }, { fieldIndex: 2, aggregation: 'AVERAGE' as const }];
    const result = buildPivot(makeConfig({ valueFields: vfs }));
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const totals = result.rowTotals.get(rk.join('\x00'));
    expect(totals).toHaveLength(2);
    expect(totals?.[0]).toBe(375);
    expect(totals?.[1]).toBe(125);
  });

  it('grand total has one entry per value field', () => {
    const vfs = [{ fieldIndex: 2, aggregation: 'MIN' as const }, { fieldIndex: 2, aggregation: 'MAX' as const }];
    const result = buildPivot(makeConfig({ valueFields: vfs }));
    expect(result.grandTotal).toEqual([50, 300]);
  });
});

describe('buildPivot — empty colFields', () => {
  it('handles no column grouping', () => {
    const result = buildPivot(makeConfig({ colFields: [] }));
    expect(result.colKeys.length).toBe(1);
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const ck = result.colKeys[0];
    const val = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`)?.[0];
    expect(val).toBe(375);
  });
});

describe('buildPivot — null for missing intersection', () => {
  it('returns null for groups with no matching data', () => {
    const data: string[][] = [
      ['A', 'X', '10'],
      ['B', 'Y', '20'],
    ];
    const result = buildPivot({
      rowFields: [0], colFields: [1],
      valueFields: [{ fieldIndex: 2, aggregation: 'SUM' }],
      dataRows: data, headers: ['Row', 'Col', 'Val'],
    });
    const rk = result.rowKeys.find((k) => k[0] === 'A')!;
    const ck = result.colKeys.find((k) => k[0] === 'Y')!;
    const val = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`)?.[0];
    expect(val).toBeNull();
  });
});
