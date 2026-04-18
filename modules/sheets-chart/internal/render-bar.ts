/** Contract: contracts/sheets-chart/rules.md */

import { type Rect, type SeriesData } from './types.ts';
import { createBandScale } from './scale-band.ts';
import { createLinearScale } from './scale-linear.ts';
import { computeLayout } from './chart-layout.ts';
import { renderXAxisBand, renderYAxis, renderGridLines } from './render-axes.ts';
import { renderLegend } from './render-legend.ts';
import * as svg from './svg-builder.ts';

export interface BarChartOptions {
  width: number;
  height: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  categories: string[];
  series: SeriesData[];
  stacked?: boolean;
}

export function renderBarChart(options: BarChartOptions): string {
  const { width, height, title, xLabel, yLabel, categories, series, stacked } = options;

  const layout = computeLayout({
    width, height,
    hasTitle: !!title,
    hasLegend: series.length > 1,
    hasXLabel: !!xLabel,
    hasYLabel: !!yLabel,
  });

  const allValues = collectValues(series, stacked);
  const yScale = createLinearScale({
    values: allValues,
    rangeStart: layout.plot.y + layout.plot.height,
    rangeEnd: layout.plot.y,
  });

  const xScale = createBandScale({
    labels: categories,
    rangeStart: layout.plot.x,
    rangeEnd: layout.plot.x + layout.plot.width,
  });

  const parts: string[] = [];
  parts.push(svg.rect(0, 0, width, height, '#fff'));

  if (title) {
    parts.push(svg.text(width / 2, layout.title.height / 2 + layout.title.y + 8, title, {
      fontSize: 14, fill: '#222',
    }));
  }

  parts.push(renderGridLines(layout.plot, yScale.ticks));
  parts.push(renderYAxis(layout.plot, yScale.ticks, yLabel));
  parts.push(renderXAxisBand(layout.plot, categories, xScale.bandwidth, xScale.scale, xLabel));

  parts.push(renderBars(layout.plot, xScale, yScale, series, stacked));

  if (series.length > 1) {
    parts.push(renderLegend(layout.legendArea, series));
  }

  return svg.svgOpen(width, height) + parts.join('') + svg.svgClose();
}

function renderBars(
  plot: Rect,
  xScale: ReturnType<typeof createBandScale>,
  yScale: ReturnType<typeof createLinearScale>,
  series: SeriesData[],
  stacked?: boolean,
): string {
  const parts: string[] = [];
  const seriesCount = series.length;
  const barWidth = stacked ? xScale.bandwidth : xScale.bandwidth / seriesCount;
  const zeroY = yScale.scale(0);

  for (let ci = 0; ci < (series[0]?.values.length ?? 0); ci++) {
    let stackBase = zeroY;

    for (let si = 0; si < seriesCount; si++) {
      const val = series[si].values[ci] ?? 0;
      const valY = yScale.scale(val);

      if (stacked) {
        const barH = Math.abs(stackBase - valY);
        const barY = val >= 0 ? stackBase - barH : stackBase;
        parts.push(svg.rect(xScale.scale(ci), barY, barWidth - 1, barH, series[si].color, 'rx="2"'));
        stackBase = barY;
      } else {
        const x = xScale.scale(ci) + si * barWidth;
        const barH = Math.abs(zeroY - valY);
        const barY = val >= 0 ? valY : zeroY;
        parts.push(svg.rect(x, barY, barWidth - 1, barH, series[si].color, 'rx="2"'));
      }
    }
  }

  return svg.group(parts);
}

function collectValues(series: SeriesData[], stacked?: boolean): number[] {
  if (!stacked) return series.flatMap((s) => s.values);

  const len = Math.max(...series.map((s) => s.values.length));
  const sums: number[] = [];
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const s of series) sum += s.values[i] ?? 0;
    sums.push(sum);
  }
  return [...sums, 0];
}
