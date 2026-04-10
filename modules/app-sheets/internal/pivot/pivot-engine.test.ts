/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { buildPivot, type PivotConfig } from './pivot-engine.ts';

// Sample data: Region, Product, Sales
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
    rowFields: [0],   // Region
    colFields: [1],   // Product
    valueField: 2,    // Sales
    aggregation: 'SUM',
    dataRows: DATA,
    headers: HEADERS,
    ...overrides,
  };
}

describe('buildPivot — SUM', () => {
  it('produces correct row and column keys', () => {
    const result = buildPivot(makeConfig());
    const rowKeys = result.rowKeys.map((k) => k[0]);
    const colKeys = result.colKeys.map((k) => k[0]);
    expect(rowKeys).toContain('East');
    expect(rowKeys).toContain('West');
    expect(colKeys).toContain('Widget');
    expect(colKeys).toContain('Gadget');
  });

  it('sums East-Widget correctly', () => {
    const result = buildPivot(makeConfig());
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    // East+Widget: 100 + 75 = 175
    expect(cell).toBe(175);
  });

  it('sums West-Widget correctly', () => {
    const result = buildPivot(makeConfig());
    const rk = result.rowKeys.find((k) => k[0] === 'West')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    // West+Widget: 150 + 50 = 200
    expect(cell).toBe(200);
  });

  it('computes row totals correctly for East', () => {
    const result = buildPivot(makeConfig());
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const total = result.rowTotals.get(rk.join('\x00'));
    // East total: 100 + 200 + 75 = 375
    expect(total).toBe(375);
  });

  it('computes column totals correctly for Widget', () => {
    const result = buildPivot(makeConfig());
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const total = result.colTotals.get(ck.join('\x00'));
    // Widget total: 100 + 75 + 150 + 50 = 375
    expect(total).toBe(375);
  });

  it('computes grand total', () => {
    const result = buildPivot(makeConfig());
    // 100+200+150+50+300+75 = 875
    expect(result.grandTotal).toBe(875);
  });
});

describe('buildPivot — COUNT', () => {
  it('counts rows per group', () => {
    const result = buildPivot(makeConfig({ aggregation: 'COUNT' }));
    const rk = result.rowKeys.find((k) => k[0] === 'West')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    // West+Widget appears 2 times
    expect(cell).toBe(2);
  });

  it('grand total equals row count', () => {
    const result = buildPivot(makeConfig({ aggregation: 'COUNT' }));
    expect(result.grandTotal).toBe(DATA.length);
  });
});

describe('buildPivot — AVERAGE', () => {
  it('averages East-Widget correctly', () => {
    const result = buildPivot(makeConfig({ aggregation: 'AVERAGE' }));
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    // (100 + 75) / 2 = 87.5
    expect(cell).toBe(87.5);
  });
});

describe('buildPivot — MIN/MAX', () => {
  it('MIN: West-Widget = 50', () => {
    const result = buildPivot(makeConfig({ aggregation: 'MIN' }));
    const rk = result.rowKeys.find((k) => k[0] === 'West')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    expect(cell).toBe(50);
  });

  it('MAX: West-Widget = 150', () => {
    const result = buildPivot(makeConfig({ aggregation: 'MAX' }));
    const rk = result.rowKeys.find((k) => k[0] === 'West')!;
    const ck = result.colKeys.find((k) => k[0] === 'Widget')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    expect(cell).toBe(150);
  });
});

describe('buildPivot — empty colFields', () => {
  it('handles no column grouping', () => {
    const result = buildPivot(makeConfig({ colFields: [] }));
    // One empty colKey represents the "all" bucket
    expect(result.colKeys.length).toBe(1);
    const rk = result.rowKeys.find((k) => k[0] === 'East')!;
    const ck = result.colKeys[0];
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    expect(cell).toBe(375);
  });
});

describe('buildPivot — null for missing intersection', () => {
  it('returns null for groups with no matching data', () => {
    // Add data where not all row×col combos exist
    const data: string[][] = [
      ['A', 'X', '10'],
      ['B', 'Y', '20'],
    ];
    const result = buildPivot({
      rowFields: [0], colFields: [1], valueField: 2,
      aggregation: 'SUM', dataRows: data, headers: ['Row', 'Col', 'Val'],
    });
    const rk = result.rowKeys.find((k) => k[0] === 'A')!;
    const ck = result.colKeys.find((k) => k[0] === 'Y')!;
    const cell = result.cells.get(`${rk.join('\x00')}|||${ck.join('\x00')}`);
    expect(cell).toBeNull();
  });
});
