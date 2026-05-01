/** Contract: contracts/sheets-chart/rules.md */

import { type PieSlice } from './types.ts';
import { computePieLayout } from './chart-layout.ts';
import { renderPieLegend } from './render-legend.ts';
import { getColor, type PaletteName } from './color-palette.ts';
import * as svg from './svg-builder.ts';

export interface PieChartOptions {
  width: number;
  height: number;
  title?: string;
  labels: string[];
  values: number[];
  palette?: PaletteName;
  showPercentages?: boolean;
}

export function renderPieChart(options: PieChartOptions): string {
  const { width, height, title, labels, values, palette, showPercentages = true } = options;

  const layout = computePieLayout({
    width, height,
    hasTitle: !!title,
    hasLegend: labels.length > 1,
  });

  const slices = computeSlices(labels, values, palette);
  const parts: string[] = [];
  parts.push(svg.rect(0, 0, width, height, '#fff'));

  if (title) {
    parts.push(svg.text(width / 2, layout.title.height / 2 + layout.title.y + 8, title, {
      fontSize: 14, fill: '#222',
    }));
  }

  const { centerX, centerY, radius } = layout;

  if (slices.length === 0 || slices.every((s) => s.value === 0)) {
    parts.push(svg.circle(centerX, centerY, radius, '#eee'));
    parts.push(svg.text(centerX, centerY, 'No data', { fontSize: 12, fill: '#999' }));
  } else if (slices.length === 1 && slices[0].percentage === 100) {
    parts.push(svg.circle(centerX, centerY, radius, slices[0].color));
    if (showPercentages) {
      parts.push(svg.text(centerX, centerY, '100%', { fontSize: 12, fill: '#fff' }));
    }
  } else {
    for (const slice of slices) {
      if (slice.value <= 0) continue;
      parts.push(renderSlice(centerX, centerY, radius, slice));

      if (showPercentages && slice.percentage >= 5) {
        const midAngle = (slice.startAngle + slice.endAngle) / 2;
        const labelR = radius * 0.65;
        const lx = centerX + labelR * Math.cos(midAngle);
        const ly = centerY + labelR * Math.sin(midAngle);
        parts.push(svg.text(lx, ly, `${Math.round(slice.percentage)}%`, {
          fontSize: 10, fill: '#fff',
        }));
      }
    }
  }

  if (labels.length > 1) {
    const legendSlices = slices.map((s) => ({ label: s.label, color: s.color }));
    parts.push(renderPieLegend(layout.legendArea, legendSlices));
  }

  return svg.svgOpen(width, height) + parts.join('') + svg.svgClose();
}

function renderSlice(cx: number, cy: number, r: number, slice: PieSlice): string {
  const { startAngle, endAngle, color } = slice;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const d = [
    `M${cx},${cy}`,
    `L${x1.toFixed(2)},${y1.toFixed(2)}`,
    `A${r},${r} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
    'Z',
  ].join(' ');

  return svg.path(d, color, '#fff');
}

export function computeSlices(
  labels: string[],
  values: number[],
  palette?: PaletteName,
): PieSlice[] {
  const positiveValues = values.map((v) => Math.max(0, v));
  const total = positiveValues.reduce((a, b) => a + b, 0);

  if (total === 0) return [];

  const slices: PieSlice[] = [];
  let currentAngle = -Math.PI / 2;

  for (let i = 0; i < labels.length; i++) {
    const value = positiveValues[i] ?? 0;
    const percentage = (value / total) * 100;
    const sliceAngle = (value / total) * Math.PI * 2;

    slices.push({
      label: labels[i] ?? `Slice ${i + 1}`,
      value,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle,
      color: getColor(i, palette),
    });

    currentAngle += sliceAngle;
  }

  return slices;
}
