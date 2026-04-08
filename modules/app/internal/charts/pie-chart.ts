/** Contract: contracts/app/charts.md */

const TITLE_FONT = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
const LABEL_FONT = '11px -apple-system, BlinkMacSystemFont, sans-serif';

export function renderPieChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: { labels: string[]; values: number[] },
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
  ctx.fillText(title || 'Pie Chart', width / 2, 24);

  const total = data.values.reduce((sum, v) => sum + Math.abs(v), 0);
  if (total === 0 || data.values.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = LABEL_FONT;
    ctx.fillText('No data', width / 2, height / 2);
    return;
  }

  const cx = width / 2;
  const cy = height / 2 + 10;
  const radius = Math.min(width, height) / 2 - 60;
  if (radius <= 0) return;

  let angle = -Math.PI / 2;

  for (let i = 0; i < data.values.length; i++) {
    const val = Math.abs(data.values[i]);
    const sliceAngle = (val / total) * Math.PI * 2;
    const color = colors[i % colors.length];

    // Slice
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    // Slice border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    if (sliceAngle > 0.15) {
      const midAngle = angle + sliceAngle / 2;
      const labelR = radius * 0.7;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      const pct = ((val / total) * 100).toFixed(1) + '%';

      ctx.fillStyle = '#fff';
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.fillText(pct, lx, ly + 4);
    }

    angle += sliceAngle;
  }

  // Legend
  renderPieLegend(ctx, width, height, data.labels, data.values, total, colors);
}

function renderPieLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  labels: string[],
  values: number[],
  total: number,
  colors: string[],
): void {
  ctx.font = LABEL_FONT;
  const legendY = height - 20;
  let lx = 10;

  for (let i = 0; i < labels.length && i < 8; i++) {
    const label = labels[i] || `Item ${i + 1}`;
    const pct = ((Math.abs(values[i]) / total) * 100).toFixed(0) + '%';
    const text = `${label} (${pct})`;
    const tw = ctx.measureText(text).width;

    if (lx + tw + 20 > width) break;

    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, legendY - 8, 10, 10);
    ctx.fillStyle = '#333';
    ctx.fillText(text, lx + 14, legendY);
    lx += tw + 28;
  }
}
