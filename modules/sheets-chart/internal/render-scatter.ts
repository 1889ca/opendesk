/** Contract: contracts/sheets-chart/rules.md */

import { type SeriesData } from './types.ts';
import { createLinearScale } from './scale-linear.ts';
import { computeLayout } from './chart-layout.ts';
import { renderXAxis, renderYAxis, renderGridLines } from './render-axes.ts';
import { renderLegend } from './render-legend.ts';
import * as svg from './svg-builder.ts';

export interface ScatterSeries {
  name: string;
  points: { x: number; y: number }[];
  color: string;
}

export interface ScatterChartOptions {
  width: number;
  height: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  series: ScatterSeries[];
  dotRadius?: number;
}

export function renderScatterChart(options: ScatterChartOptions): string {
  const { width, height, title, xLabel, yLabel, series, dotRadius = 4 } = options;

  const layout = computeLayout({
    width, height,
    hasTitle: !!title,
    hasLegend: series.length > 1,
    hasXLabel: !!xLabel,
    hasYLabel: !!yLabel,
  });

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));

  const xScale = createLinearScale({
    values: allX,
    rangeStart: layout.plot.x,
    rangeEnd: layout.plot.x + layout.plot.width,
    forceZero: false,
  });

  const yScale = createLinearScale({
    values: allY,
    rangeStart: layout.plot.y + layout.plot.height,
    rangeEnd: layout.plot.y,
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
  parts.push(renderXAxis(layout.plot, xScale.ticks, xLabel));

  for (const s of series) {
    for (const p of s.points) {
      const sx = xScale.scale(p.x);
      const sy = yScale.scale(p.y);
      parts.push(svg.circle(sx, sy, dotRadius, s.color));
    }
  }

  if (series.length > 1) {
    const legendSeries: SeriesData[] = series.map((s) => ({
      name: s.name,
      values: [],
      color: s.color,
    }));
    parts.push(renderLegend(layout.legendArea, legendSeries));
  }

  return svg.svgOpen(width, height) + parts.join('') + svg.svgClose();
}
