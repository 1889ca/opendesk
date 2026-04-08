/** Contract: contracts/observability/rules.md */
/* Canvas 2D chart renderer for observability time-series data */

const CT_COLORS = { document: '#3b82f6', sheet: '#10b981', slides: '#f59e0b', kb: '#8b5cf6' };

function css(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function renderChart(canvas, buckets) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
  ctx.clearRect(0, 0, W, H);

  if (!buckets.length) {
    ctx.fillStyle = '#666'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('No data for selected range', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...buckets.map(b => b.max), 1);
  const minT = new Date(buckets[0].bucket).getTime();
  const maxT = new Date(buckets[buckets.length - 1].bucket).getTime();
  const range = maxT - minT || 1;

  drawGrid(ctx, pad, cW, cH, maxVal);
  drawLines(ctx, buckets, pad, cW, cH, minT, range, maxVal);
  drawTimeAxis(ctx, buckets, pad, cW, cH, minT, range);
}

function drawGrid(ctx, pad, cW, cH, maxVal) {
  ctx.strokeStyle = css('--border-color') || '#e0e0e0';
  ctx.lineWidth = 0.5;
  ctx.font = '11px system-ui';
  ctx.fillStyle = css('--text-secondary') || '#999';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (cH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    ctx.fillText(((maxVal * i) / 4).toFixed(1), pad.left - 8, y + 4);
  }
}

function drawLines(ctx, buckets, pad, cW, cH, minT, range, maxVal) {
  const grouped = {};
  buckets.forEach(b => (grouped[b.contentType] ??= []).push(b));

  for (const [ct, data] of Object.entries(grouped)) {
    ctx.strokeStyle = CT_COLORS[ct] || '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + ((new Date(d.bucket).getTime() - minT) / range) * cW;
      const y = pad.top + cH - (d.avg / maxVal) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = CT_COLORS[ct] || '#888';
    data.forEach(d => {
      const x = pad.left + ((new Date(d.bucket).getTime() - minT) / range) * cW;
      const y = pad.top + cH - (d.avg / maxVal) * cH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawTimeAxis(ctx, buckets, pad, cW, cH, minT, range) {
  ctx.fillStyle = css('--text-secondary') || '#999';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(buckets.length / 6));
  for (let i = 0; i < buckets.length; i += step) {
    const x = pad.left + ((new Date(buckets[i].bucket).getTime() - minT) / range) * cW;
    const label = new Date(buckets[i].bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(label, x, pad.top + cH + 20);
  }
}

// Expose for use by main dashboard script
window.__obsChart = { renderChart, CT_COLORS };
