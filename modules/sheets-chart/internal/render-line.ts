/** Contract: contracts/sheets-chart/rules.md */

import { type SeriesData } from './types.ts';
import { createBandScale } from './scale-band.ts';
import { createLinearScale } from './scale-linear.ts';
import { computeLayout } from './chart-layout.ts';
import { renderXAxisBand, renderYAxis, renderGridLines } from './render-axes.ts';
import { renderLegend } from './render-legend.ts';
import * as svg from './svg-builder.ts';

export interface LineChartOptions {
  width: number;
  height: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  categories: string[];
  series: SeriesData[];
  showDots?: boolean;
  showArea?: boolean;
}

export function renderLineChart(options: LineChartOptions): string {
  const { width, height, title, xLabel, yLabel, categories, series } = options;
  const showDots = options.showDots ?? true;
  const showArea = options.showArea ?? false;

  const layout = computeLayout({
    width, height,
    hasTitle: !!title,
    hasLegend: series.length > 1,
    hasXLabel: !!xLabel,
    hasYLabel: !!yLabel,
  });

  const allValues = series.flatMap((s) => s.values);
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

  for (const s of series) {
    const points = s.values.map((v, i) => ({
      x: xScale.scale(i) + xScale.bandwidth / 2,
      y: yScale.scale(v),
    }));

    if (showArea && points.length > 0) {
      const baseY = yScale.scale(0);
      const areaPath = buildAreaPath(points, baseY);
      parts.push(svg.path(areaPath, s.color + '20'));
    }

    if (points.length > 0) {
      parts.push(svg.polyline(points, s.color, 2));
    }

    if (showDots) {
      for (const p of points) {
        parts.push(svg.circle(p.x, p.y, 3, s.color));
      }
    }
  }

  if (series.length > 1) {
    parts.push(renderLegend(layout.legendArea, series));
  }

  return svg.svgOpen(width, height) + parts.join('') + svg.svgClose();
}

function buildAreaPath(points: { x: number; y: number }[], baseY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  let d = `M${first.x},${baseY} L${first.x},${first.y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i].x},${points[i].y}`;
  }
  d += ` L${last.x},${baseY} Z`;
  return d;
}
