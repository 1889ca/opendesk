/** Contract: contracts/observability/rules.md */

import type { TimeSeriesBucket } from './obs-api.ts';

const CONTENT_TYPE_COLORS: Record<string, string> = {
  document: '#3b82f6',
  sheet: '#10b981',
  slides: '#f59e0b',
  kb: '#8b5cf6',
};

/** Render a time-series chart on a Canvas element. */
export function renderTimeSeriesChart(
  canvas: HTMLCanvasElement,
  buckets: TimeSeriesBucket[],
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  if (buckets.length === 0) {
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-secondary').trim() || '#666';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No data for selected range', width / 2, height / 2);
    return;
  }

  const maxVal = Math.max(...buckets.map((b) => b.max), 1);
  const minTime = new Date(buckets[0].bucket).getTime();
  const maxTime = new Date(buckets[buckets.length - 1].bucket).getTime();
  const timeRange = maxTime - minTime || 1;

  // Group by contentType
  const grouped = groupByContentType(buckets);

  // Draw grid lines
  drawGrid(ctx, padding, chartW, chartH, maxVal);

  // Draw lines for each content type
  for (const [ct, data] of Object.entries(grouped)) {
    const color = CONTENT_TYPE_COLORS[ct] ?? '#888';
    drawLine(ctx, data, padding, chartW, chartH, minTime, timeRange, maxVal, color);
  }

  // Draw legend
  drawLegend(ctx, Object.keys(grouped), width, padding);

  // Draw x-axis labels
  drawTimeAxis(ctx, buckets, padding, chartW, chartH, minTime, timeRange);
}

function groupByContentType(
  buckets: TimeSeriesBucket[],
): Record<string, TimeSeriesBucket[]> {
  const result: Record<string, TimeSeriesBucket[]> = {};
  for (const b of buckets) {
    (result[b.contentType] ??= []).push(b);
  }
  return result;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  p: { top: number; left: number },
  w: number,
  h: number,
  maxVal: number,
): void {
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-secondary').trim() || '#999';
  const gridColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--border-color').trim() || '#e0e0e0';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.font = '11px system-ui';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const y = p.top + h - (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(p.left, y);
    ctx.lineTo(p.left + w, y);
    ctx.stroke();
    ctx.fillText(((maxVal * i) / 4).toFixed(1), p.left - 8, y + 4);
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  data: TimeSeriesBucket[],
  p: { top: number; left: number },
  w: number,
  h: number,
  minTime: number,
  timeRange: number,
  maxVal: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < data.length; i++) {
    const t = new Date(data[i].bucket).getTime();
    const x = p.left + ((t - minTime) / timeRange) * w;
    const y = p.top + h - (data[i].avg / maxVal) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();

  // Draw points
  ctx.fillStyle = color;
  for (const point of data) {
    const t = new Date(point.bucket).getTime();
    const x = p.left + ((t - minTime) / timeRange) * w;
    const y = p.top + h - (point.avg / maxVal) * h;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  types: string[],
  width: number,
  p: { top: number },
): void {
  ctx.font = '11px system-ui';
  let x = width - 20;
  for (const ct of types.reverse()) {
    const label = ct.charAt(0).toUpperCase() + ct.slice(1);
    const textW = ctx.measureText(label).width;
    x -= textW + 24;
    ctx.fillStyle = CONTENT_TYPE_COLORS[ct] ?? '#888';
    ctx.fillRect(x, p.top - 12, 12, 12);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-primary').trim() || '#333';
    ctx.fillText(label, x + 16, p.top - 2);
  }
}

function drawTimeAxis(
  ctx: CanvasRenderingContext2D,
  buckets: TimeSeriesBucket[],
  p: { top: number; left: number; bottom: number },
  w: number,
  h: number,
  minTime: number,
  timeRange: number,
): void {
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-secondary').trim() || '#999';
  ctx.fillStyle = textColor;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';

  const step = Math.max(1, Math.floor(buckets.length / 6));
  for (let i = 0; i < buckets.length; i += step) {
    const t = new Date(buckets[i].bucket).getTime();
    const x = p.left + ((t - minTime) / timeRange) * w;
    const label = new Date(buckets[i].bucket).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    ctx.fillText(label, x, p.top + h + 20);
  }
}
