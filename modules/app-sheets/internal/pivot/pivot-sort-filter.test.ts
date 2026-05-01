/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { buildPivot } from './pivot-engine.ts';
import { sortPivotRows, filterPivotRows } from './pivot-sort-filter.ts';

const HEADERS = ['Region', 'Product', 'Sales'];
const DATA: string[][] = [
  ['East', 'Widget', '100'],
  ['East', 'Gadget', '200'],
  ['West', 'Widget', '150'],
  ['West', 'Gadget', '300'],
  ['North', 'Widget', '50'],
  ['North', 'Gadget', '400'],
  ['South', 'Widget', '250'],
  ['South', 'Gadget', '120'],
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

describe('sortPivotRows — by label', () => {
  it('sorts ascending by default label', () => {
    const result = sortPivotRows(makePivot(), {
      by: 'label',
      direction: 'asc',
    });
    const labels = result.rowKeys.map((k) => k[0]);
    expect(labels).toEqual(['East', 'North', 'South', 'West']);
  });

  it('sorts descending by label', () => {
    const result = sortPivotRows(makePivot(), {
      by: 'label',
      direction: 'desc',
    });
    const labels = result.rowKeys.map((k) => k[0]);
    expect(labels).toEqual(['West', 'South', 'North', 'East']);
  });
});

describe('sortPivotRows — by value', () => {
  it('sorts ascending by row total', () => {
    const result = sortPivotRows(makePivot(), {
      by: 'value',
      direction: 'asc',
    });
    const labels = result.rowKeys.map((k) => k[0]);
    expect(labels[0]).toBe('East');
    expect(labels[labels.length - 1]).toBe('West');
  });

  it('sorts descending by row total', () => {
    const result = sortPivotRows(makePivot(), {
      by: 'value',
      direction: 'desc',
    });
    const labels = result.rowKeys.map((k) => k[0]);
    expect(labels[0]).not.toBe('East');
  });

  it('can sort by a specific column value', () => {
    const pivot = makePivot();
    const widgetIdx = pivot.colKeys.findIndex((k) => k[0] === 'Widget');
    const result = sortPivotRows(pivot, {
      by: 'value',
      direction: 'desc',
      colKeyIndex: widgetIdx,
    });
    const labels = result.rowKeys.map((k) => k[0]);
    expect(labels[0]).toBe('South');
  });
});

describe('filterPivotRows — top_n', () => {
  it('returns only the top N rows by total', () => {
    const result = filterPivotRows(makePivot(), {
      type: 'top_n',
      n: 2,
      valueIndex: 0,
    });
    expect(result.rowKeys).toHaveLength(2);
  });

  it('top 1 is the row with highest total', () => {
    const pivot = makePivot();
    const result = filterPivotRows(pivot, {
      type: 'top_n',
      n: 1,
      valueIndex: 0,
    });
    expect(result.rowKeys).toHaveLength(1);
    const topLabel = result.rowKeys[0][0];
    const topTotal = result.rowTotals.get(result.rowKeys[0].join('\x00'))?.[0];
    for (const rk of pivot.rowKeys) {
      const t = pivot.rowTotals.get(rk.join('\x00'))?.[0] ?? 0;
      expect(topTotal).toBeGreaterThanOrEqual(t);
    }
  });
});

describe('filterPivotRows — bottom_n', () => {
  it('returns only the bottom N rows by total', () => {
    const result = filterPivotRows(makePivot(), {
      type: 'bottom_n',
      n: 2,
      valueIndex: 0,
    });
    expect(result.rowKeys).toHaveLength(2);
  });

  it('bottom 1 is the row with lowest total', () => {
    const pivot = makePivot();
    const result = filterPivotRows(pivot, {
      type: 'bottom_n',
      n: 1,
      valueIndex: 0,
    });
    expect(result.rowKeys).toHaveLength(1);
    const botTotal = result.rowTotals.get(result.rowKeys[0].join('\x00'))?.[0];
    for (const rk of pivot.rowKeys) {
      const t = pivot.rowTotals.get(rk.join('\x00'))?.[0] ?? Infinity;
      expect(botTotal).toBeLessThanOrEqual(t);
    }
  });
});

describe('filterPivotRows — above/below threshold', () => {
  it('above: keeps only rows with total above threshold', () => {
    const result = filterPivotRows(makePivot(), {
      type: 'above',
      threshold: 400,
      valueIndex: 0,
    });
    for (const rk of result.rowKeys) {
      const t = result.rowTotals.get(rk.join('\x00'))?.[0] ?? 0;
      expect(t).toBeGreaterThan(400);
    }
  });

  it('below: keeps only rows with total below threshold', () => {
    const result = filterPivotRows(makePivot(), {
      type: 'below',
      threshold: 400,
      valueIndex: 0,
    });
    for (const rk of result.rowKeys) {
      const t = result.rowTotals.get(rk.join('\x00'))?.[0] ?? Infinity;
      expect(t).toBeLessThan(400);
    }
    expect(result.rowKeys.length).toBeGreaterThan(0);
  });
});

describe('filterPivotRows — preserves cells/totals', () => {
  it('cell values remain accessible after filtering', () => {
    const pivot = makePivot();
    const result = filterPivotRows(pivot, {
      type: 'top_n',
      n: 2,
      valueIndex: 0,
    });
    for (const rk of result.rowKeys) {
      for (const ck of result.colKeys) {
        const key = `${rk.join('\x00')}|||${ck.join('\x00')}`;
        expect(result.cells.has(key)).toBe(true);
      }
    }
  });
});
