/** Contract: contracts/app/observability-dashboard.md */

export interface TimeSeriesPoint {
  bucket: string;
  requestCount: number;
  errorCount: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
}

interface ChartOptions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

const DEFAULTS: ChartOptions = {
  width: 600,
  height: 200,
  padding: { top: 20, right: 16, bottom: 32, left: 56 },
};

const COLORS = {
  requestCount: '#3b82f6',
  errorCount: '#ef4444',
  p50: '#22c55e',
  p95: '#f59e0b',
  p99: '#ef4444',
  grid: 'rgba(128, 128, 128, 0.15)',
  label: '#888',
};

/** Prepare chart area and return context + drawing bounds. */
function setupCanvas(
  canvas: HTMLCanvasElement,
  opts: ChartOptions,
): { ctx: CanvasRenderingContext2D; x0: number; y0: number; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = opts.width * dpr;
  canvas.height = opts.height * dpr;
  canvas.style.width = `${opts.width}px`;
  canvas.style.height = `${opts.height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, opts.width, opts.height);

  const x0 = opts.padding.left;
  const y0 = opts.padding.top;
  const w = opts.width - opts.padding.left - opts.padding.right;
  const h = opts.height - opts.padding.top - opts.padding.bottom;

  return { ctx, x0, y0, w, h };
}

/** Draw horizontal grid lines and Y axis labels. */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
  maxVal: number, steps: number, unit: string,
): void {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.label;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';

  for (let i = 0; i <= steps; i++) {
    const y = y0 + h - (i / steps) * h;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
    ctx.stroke();
    const val = (maxVal / steps) * i;
    ctx.fillText(`${Math.round(val)}${unit}`, x0 - 4, y + 3);
  }
}

/** Draw X axis time labels. */
function drawTimeLabels(
  ctx: CanvasRenderingContext2D,
  points: TimeSeriesPoint[],
  x0: number, y0: number, w: number, h: number,
): void {
  if (points.length === 0) return;
  ctx.fillStyle = COLORS.label;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';

  const step = Math.max(1, Math.floor(points.length / 6));
  for (let i = 0; i < points.length; i += step) {
    const x = x0 + (i / Math.max(1, points.length - 1)) * w;
    const time = new Date(points[i].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(time, x, y0 + h + 16);
  }
}

/** Draw a line series on the chart. */
function drawLine(
  ctx: CanvasRenderingContext2D,
  values: number[], maxVal: number,
  x0: number, y0: number, w: number, h: number,
  color: string, lineWidth = 1.5,
): void {
  if (values.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = x0 + (i / Math.max(1, values.length - 1)) * w;
    const y = y0 + h - (values[i] / Math.max(1, maxVal)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Render request volume chart (requests + errors as bar-like lines). */
export function renderVolumeChart(canvas: HTMLCanvasElement, points: TimeSeriesPoint[]): void {
  const opts = { ...DEFAULTS, width: canvas.parentElement?.clientWidth ?? DEFAULTS.width };
  const { ctx, x0, y0, w, h } = setupCanvas(canvas, opts);

  if (points.length === 0) {
    ctx.fillStyle = COLORS.label;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for selected range', opts.width / 2, opts.height / 2);
    return;
  }

  const maxReqs = Math.max(1, ...points.map((p) => p.requestCount));
  drawGrid(ctx, x0, y0, w, h, maxReqs, 4, '');
  drawTimeLabels(ctx, points, x0, y0, w, h);
  drawLine(ctx, points.map((p) => p.requestCount), maxReqs, x0, y0, w, h, COLORS.requestCount, 2);
  drawLine(ctx, points.map((p) => p.errorCount), maxReqs, x0, y0, w, h, COLORS.errorCount, 1.5);
}

/** Render latency chart (p50, p95, p99 lines). */
export function renderLatencyChart(canvas: HTMLCanvasElement, points: TimeSeriesPoint[]): void {
  const opts = { ...DEFAULTS, width: canvas.parentElement?.clientWidth ?? DEFAULTS.width };
  const { ctx, x0, y0, w, h } = setupCanvas(canvas, opts);

  if (points.length === 0) {
    ctx.fillStyle = COLORS.label;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for selected range', opts.width / 2, opts.height / 2);
    return;
  }

  const maxMs = Math.max(1, ...points.map((p) => p.p99DurationMs));
  drawGrid(ctx, x0, y0, w, h, maxMs, 4, 'ms');
  drawTimeLabels(ctx, points, x0, y0, w, h);
  drawLine(ctx, points.map((p) => p.p50DurationMs), maxMs, x0, y0, w, h, COLORS.p50, 1.5);
  drawLine(ctx, points.map((p) => p.p95DurationMs), maxMs, x0, y0, w, h, COLORS.p95, 1.5);
  drawLine(ctx, points.map((p) => p.p99DurationMs), maxMs, x0, y0, w, h, COLORS.p99, 1);
}
