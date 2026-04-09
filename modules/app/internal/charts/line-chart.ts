/** Contract: contracts/app/charts.md */
import type { ChartDataSet } from './chart-data.ts';

const PADDING = { top: 40, right: 20, bottom: 50, left: 60 };
const LABEL_FONT = '11px -apple-system, BlinkMacSystemFont, sans-serif';
const TITLE_FONT = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';

export function renderLineChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartDataSet,
  title: string,
  colors: string[],
): void {
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#333';
  ctx.font = TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(title || 'Line Chart', width / 2, 24);

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  if (plotW <= 0 || plotH <= 0 || data.series.length === 0) return;

  // Max value
  let maxVal = 0;
  for (const s of data.series) {
    for (const v of s.values) {
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;

  const pointCount = data.labels.length || 1;

  // Y axis gridlines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.font = LABEL_FONT;
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const y = PADDING.top + plotH - (plotH * i) / steps;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(PADDING.left + plotW, y);
    ctx.stroke();
    const val = ((maxVal * i) / steps).toFixed(maxVal >= 10 ? 0 : 1);
    ctx.fillText(val, PADDING.left - 8, y + 4);
  }

  // Lines
  for (let s = 0; s < data.series.length; s++) {
    const series = data.series[s];
    const color = colors[s % colors.length];

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let p = 0; p < pointCount; p++) {
      const val = series.values[p] || 0;
      const x = PADDING.left + (p / Math.max(pointCount - 1, 1)) * plotW;
      const y = PADDING.top + plotH - (val / maxVal) * plotH;

      if (p === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = color;
    for (let p = 0; p < pointCount; p++) {
      const val = series.values[p] || 0;
      const x = PADDING.left + (p / Math.max(pointCount - 1, 1)) * plotW;
      const y = PADDING.top + plotH - (val / maxVal) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // X labels
  ctx.fillStyle = '#666';
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  for (let p = 0; p < pointCount; p++) {
    const x = PADDING.left + (p / Math.max(pointCount - 1, 1)) * plotW;
    const label = data.labels[p] || '';
    const truncated = label.length > 10 ? label.slice(0, 9) + '...' : label;
    ctx.fillText(truncated, x, height - PADDING.bottom + 16);
  }

  // Legend
  if (data.series.length > 1) {
    ctx.font = LABEL_FONT;
    let lx = width - PADDING.right;
    for (let i = data.series.length - 1; i >= 0; i--) {
      const name = data.series[i].name;
      const tw = ctx.measureText(name).width;
      lx -= tw + 20;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(lx, 6, 10, 10);
      ctx.fillStyle = '#333';
      ctx.fillText(name, lx + 14, 15);
    }
  }
}
