/** Contract: contracts/sheets-chart/rules.md */

import { type Rect, type Tick } from './types.ts';
import * as svg from './svg-builder.ts';

export function renderXAxis(
  plot: Rect,
  ticks: Tick[],
  label?: string,
): string {
  const parts: string[] = [];
  const y = plot.y + plot.height;

  parts.push(svg.line(plot.x, y, plot.x + plot.width, y, '#ccc'));

  for (const tick of ticks) {
    const x = tick.position;
    parts.push(svg.line(x, y, x, y + 5, '#999'));
    parts.push(svg.text(x, y + 16, tick.label, { fontSize: 10, fill: '#666' }));
  }

  if (label) {
    const cx = plot.x + plot.width / 2;
    parts.push(svg.text(cx, y + 38, label, { fontSize: 12, fill: '#444' }));
  }

  return svg.group(parts);
}

export function renderXAxisBand(
  plot: Rect,
  labels: string[],
  bandwidth: number,
  scaleFn: (i: number) => number,
  label?: string,
): string {
  const parts: string[] = [];
  const y = plot.y + plot.height;

  parts.push(svg.line(plot.x, y, plot.x + plot.width, y, '#ccc'));

  for (let i = 0; i < labels.length; i++) {
    const x = scaleFn(i) + bandwidth / 2;
    const displayLabel = labels[i].length > 12 ? labels[i].slice(0, 11) + '\u2026' : labels[i];
    parts.push(svg.text(x, y + 16, displayLabel, { fontSize: 10, fill: '#666' }));
  }

  if (label) {
    const cx = plot.x + plot.width / 2;
    parts.push(svg.text(cx, y + 38, label, { fontSize: 12, fill: '#444' }));
  }

  return svg.group(parts);
}

export function renderYAxis(
  plot: Rect,
  ticks: Tick[],
  label?: string,
): string {
  const parts: string[] = [];

  parts.push(svg.line(plot.x, plot.y, plot.x, plot.y + plot.height, '#ccc'));

  for (const tick of ticks) {
    const y = tick.position;
    parts.push(svg.line(plot.x - 5, y, plot.x, y, '#999'));
    parts.push(svg.text(plot.x - 8, y, tick.label, { anchor: 'end', fontSize: 10, fill: '#666' }));
  }

  if (label) {
    const cy = plot.y + plot.height / 2;
    parts.push(svg.text(plot.x - 44, cy, label, {
      fontSize: 12,
      fill: '#444',
      rotate: -90,
    }));
  }

  return svg.group(parts);
}

export function renderGridLines(plot: Rect, yTicks: Tick[]): string {
  const parts: string[] = [];
  for (const tick of yTicks) {
    parts.push(svg.line(plot.x, tick.position, plot.x + plot.width, tick.position, '#eee'));
  }
  return svg.group(parts);
}
