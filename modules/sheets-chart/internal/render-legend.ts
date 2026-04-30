/** Contract: contracts/sheets-chart/rules.md */

import { type Rect, type SeriesData } from './types.ts';
import * as svg from './svg-builder.ts';

export function renderLegend(area: Rect, series: SeriesData[]): string {
  if (series.length <= 1 || area.height === 0) return '';

  const parts: string[] = [];
  const itemWidth = 100;
  const totalWidth = series.length * itemWidth;
  const startX = area.x + (area.width - totalWidth) / 2;
  const cy = area.y + area.height / 2;

  for (let i = 0; i < series.length; i++) {
    const x = startX + i * itemWidth;
    parts.push(svg.rect(x, cy - 5, 12, 10, series[i].color, 'rx="2"'));
    const label = series[i].name.length > 12
      ? series[i].name.slice(0, 11) + '\u2026'
      : series[i].name;
    parts.push(svg.text(x + 18, cy, label, {
      anchor: 'start',
      fontSize: 10,
      fill: '#555',
    }));
  }

  return svg.group(parts);
}

export function renderPieLegend(
  area: Rect,
  slices: { label: string; color: string }[],
): string {
  if (area.height === 0) return '';

  const parts: string[] = [];
  const itemWidth = Math.min(120, area.width / Math.max(slices.length, 1));
  const totalWidth = slices.length * itemWidth;
  const startX = area.x + (area.width - totalWidth) / 2;
  const cy = area.y + area.height / 2;

  for (let i = 0; i < slices.length; i++) {
    const x = startX + i * itemWidth;
    parts.push(svg.rect(x, cy - 5, 10, 10, slices[i].color, 'rx="2"'));
    const label = slices[i].label.length > 10
      ? slices[i].label.slice(0, 9) + '\u2026'
      : slices[i].label;
    parts.push(svg.text(x + 14, cy, label, {
      anchor: 'start',
      fontSize: 10,
      fill: '#555',
    }));
  }

  return svg.group(parts);
}
