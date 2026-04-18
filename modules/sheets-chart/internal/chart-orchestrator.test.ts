/** Contract: contracts/sheets-chart/rules.md */
import { describe, it, expect } from 'vitest';
import { renderChart } from './chart-orchestrator.ts';

const salesData = [
  ['Month', 'Sales', 'Costs'],
  ['Jan', '100', '60'],
  ['Feb', '150', '80'],
  ['Mar', '120', '70'],
  ['Apr', '180', '90'],
];

describe('renderChart', () => {
  describe('bar chart', () => {
    it('produces valid SVG', () => {
      const result = renderChart(
        { type: 'bar', title: 'Sales by Month' },
        salesData,
      );
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toMatch(/^<svg/);
      expect(result.svg).toMatch(/<\/svg>$/);
    });

    it('respects dimensions', () => {
      const result = renderChart(
        { type: 'bar', width: 800, height: 500 },
        salesData,
      );
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('width="800"');
      expect(result.svg).toContain('height="500"');
    });

    it('renders stacked bars', () => {
      const result = renderChart(
        { type: 'bar', stacked: true },
        salesData,
      );
      expect(result.type).toBe('svg');
    });
  });

  describe('line chart', () => {
    it('produces valid SVG with polylines', () => {
      const result = renderChart(
        { type: 'line', title: 'Trend', showDots: true },
        salesData,
      );
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('<polyline');
    });

    it('renders area fill when showArea is true', () => {
      const result = renderChart(
        { type: 'line', showArea: true },
        salesData,
      );
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('<path');
    });
  });

  describe('pie chart', () => {
    it('produces valid SVG with pie slices', () => {
      const result = renderChart(
        { type: 'pie', title: 'Distribution' },
        salesData,
      );
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('<path');
    });

    it('handles single-value pie', () => {
      const data = [['Category', 'Value'], ['Only', '100']];
      const result = renderChart({ type: 'pie' }, data);
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('<circle');
    });
  });

  describe('scatter chart', () => {
    it('produces valid SVG with circles', () => {
      const data = [
        ['X', 'Y1', 'Y2'],
        ['1', '10', '15'],
        ['2', '20', '18'],
        ['3', '15', '25'],
      ];
      const result = renderChart(
        {
          type: 'scatter',
          title: 'Correlation',
          scatterSeries: [
            { xIndex: 0, yIndex: 1, name: 'Group A' },
            { xIndex: 0, yIndex: 2, name: 'Group B' },
          ],
        },
        data,
      );
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('<circle');
    });

    it('returns error without scatterSeries config', () => {
      const result = renderChart({ type: 'scatter' }, salesData);
      expect(result.type).toBe('chart_error');
    });
  });

  describe('error handling', () => {
    it('renders empty chart for empty data', () => {
      const result = renderChart({ type: 'bar' }, []);
      expect(result.type).toBe('svg');
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('No data');
    });

    it('returns chart_error for invalid config', () => {
      const result = renderChart(
        { type: 'bar', width: 10 } as any,
        salesData,
      );
      expect(result.type).toBe('chart_error');
    });
  });

  describe('determinism', () => {
    it('produces identical SVG for identical inputs', () => {
      const config = { type: 'bar' as const, title: 'Test' };
      const r1 = renderChart(config, salesData);
      const r2 = renderChart(config, salesData);
      expect(r1).toEqual(r2);
    });
  });

  describe('multi-series', () => {
    it('renders legend for multiple series', () => {
      const result = renderChart({ type: 'line' }, salesData);
      if (result.type !== 'svg') return;
      expect(result.svg).toContain('Sales');
      expect(result.svg).toContain('Costs');
    });
  });
});
