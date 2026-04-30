/** Contract: contracts/sheets-chart/rules.md */
import { describe, it, expect } from 'vitest';
import { extractSeries } from './data-series.ts';
import { isChartError } from './types.ts';

describe('extractSeries', () => {
  const sampleData = [
    ['Month', 'Sales', 'Costs'],
    ['Jan', '100', '60'],
    ['Feb', '150', '80'],
    ['Mar', '120', '70'],
  ];

  it('extracts column-oriented series with headers', () => {
    const result = extractSeries(sampleData, {
      orientation: 'columns',
      hasHeaders: true,
    });
    expect(isChartError(result)).toBe(false);
    if (isChartError(result)) return;
    expect(result.categories).toEqual(['Jan', 'Feb', 'Mar']);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].name).toBe('Sales');
    expect(result.series[0].values).toEqual([100, 150, 120]);
    expect(result.series[1].name).toBe('Costs');
    expect(result.series[1].values).toEqual([60, 80, 70]);
  });

  it('extracts with explicit series indices', () => {
    const result = extractSeries(sampleData, {
      orientation: 'columns',
      hasHeaders: true,
      seriesIndices: [1],
    });
    if (isChartError(result)) return;
    expect(result.series).toHaveLength(1);
    expect(result.series[0].name).toBe('Sales');
  });

  it('extracts row-oriented series', () => {
    const rowData = [
      ['Category', 'Q1', 'Q2', 'Q3'],
      ['Revenue', '200', '250', '300'],
      ['Profit', '50', '60', '80'],
    ];
    const result = extractSeries(rowData, {
      orientation: 'rows',
      hasHeaders: true,
      categoryIndex: 0,
      seriesIndices: [1, 2],
    });
    if (isChartError(result)) return;
    expect(result.categories).toEqual(['Q1', 'Q2', 'Q3']);
    expect(result.series[0].name).toBe('Revenue');
    expect(result.series[0].values).toEqual([200, 250, 300]);
  });

  it('returns error for empty data', () => {
    const result = extractSeries([], { orientation: 'columns', hasHeaders: true });
    expect(isChartError(result)).toBe(true);
  });

  it('treats non-numeric values as 0', () => {
    const data = [['X', 'Y'], ['A', 'abc'], ['B', '42']];
    const result = extractSeries(data, {
      orientation: 'columns',
      hasHeaders: true,
      seriesIndices: [1],
    });
    if (isChartError(result)) return;
    expect(result.series[0].values).toEqual([0, 42]);
  });

  it('generates default series names without headers', () => {
    const data = [['A', '10'], ['B', '20']];
    const result = extractSeries(data, {
      orientation: 'columns',
      hasHeaders: false,
      seriesIndices: [1],
    });
    if (isChartError(result)) return;
    expect(result.series[0].name).toBe('Series 1');
  });

  it('assigns deterministic colors from palette', () => {
    const result = extractSeries(sampleData, {
      orientation: 'columns',
      hasHeaders: true,
    });
    if (isChartError(result)) return;
    expect(result.series[0].color).toBe('#4E79A7');
    expect(result.series[1].color).toBe('#F28E2B');
  });
});
