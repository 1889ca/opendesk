/** Contract: contracts/app/charts.md */
import type { ChartDataSet } from './chart-data.ts';

const PADDING = { top: 40, right: 20, bottom: 50, left: 60 };
const LABEL_FONT = '11px -apple-system, BlinkMacSystemFont, sans-serif';
const TITLE_FONT = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';

export function renderBarChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartDataSet,
  title: string,
  colors: string[],
): void {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#333';
  ctx.font = TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(title || 'Bar Chart', width / 2, 24);

  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  if (plotW <= 0 || plotH <= 0 || data.series.length === 0) return;

  // Compute max value
  let maxVal = 0;
  for (const s of data.series) {
    for (const v of s.values) {
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;

  const groupCount = data.labels.length || 1;
  const seriesCount = data.series.length;
  const groupWidth = plotW / groupCount;
  const barWidth = (groupWidth * 0.7) / seriesCount;
  const groupPad = groupWidth * 0.15;

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

  // Bars
  for (let g = 0; g < groupCount; g++) {
    for (let s = 0; s < seriesCount; s++) {
      const val = data.series[s].values[g] || 0;
      const barH = (val / maxVal) * plotH;
      const x = PADDING.left + g * groupWidth + groupPad + s * barWidth;
      const y = PADDING.top + plotH - barH;

      ctx.fillStyle = colors[s % colors.length];
      ctx.fillRect(x, y, barWidth - 1, barH);
    }

    // X label
    ctx.fillStyle = '#666';
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    const labelX = PADDING.left + g * groupWidth + groupWidth / 2;
    const label = data.labels[g] || '';
    const truncated = label.length > 10 ? label.slice(0, 9) + '...' : label;
    ctx.fillText(truncated, labelX, height - PADDING.bottom + 16);
  }

  // Legend
  renderLegend(ctx, width, data.series, colors);
}

function renderLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  series: { name: string }[],
  colors: string[],
): void {
  if (series.length <= 1) return;
  ctx.font = LABEL_FONT;
  let x = width - PADDING.right;
  for (let i = series.length - 1; i >= 0; i--) {
    const name = series[i].name;
    const tw = ctx.measureText(name).width;
    x -= tw + 20;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, 6, 10, 10);
    ctx.fillStyle = '#333';
    ctx.fillText(name, x + 14, 15);
  }
}
