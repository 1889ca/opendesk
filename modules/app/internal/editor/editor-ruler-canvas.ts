/** Contract: contracts/app/rules.md */

/** Draws ruler tick marks, zone backgrounds, and margin lines onto a canvas. */

const CM_PX = 37.795; // 1 cm at 96 dpi

export function drawRulerTicks(
  canvas: HTMLCanvasElement,
  paperWidth: number,
  leftMargin: number,
  rightMargin: number,
): void {
  const dpr = devicePixelRatio || 1;
  const w = canvas.offsetWidth || canvas.width;
  const h = canvas.offsetHeight || canvas.height;
  if (!w || !h) return;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue('--text-muted').trim() || '#999';
  const surface = cs.getPropertyValue('--surface').trim() || '#fff';
  const canvas2 = cs.getPropertyValue('--canvas').trim() || '#f0f0f0';
  const accent = cs.getPropertyValue('--accent').trim() || '#4f6ef7';
  const border = cs.getPropertyValue('--border').trim() || '#e0e0e0';

  // Zone backgrounds
  ctx.fillStyle = canvas2;
  ctx.fillRect(0, 0, w, h);
  const contentEnd = paperWidth - rightMargin;
  ctx.fillStyle = surface;
  ctx.fillRect(leftMargin, 0, contentEnd - leftMargin, h);

  // Separation line between zones
  ctx.strokeStyle = border;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h - 1);
  ctx.lineTo(w, h - 1);
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = muted;
  ctx.fillStyle = muted;
  ctx.font = `9px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const totalHalfCm = Math.ceil((w / CM_PX) * 2) + 2;
  for (let i = 0; i <= totalHalfCm; i++) {
    const x = i * 0.5 * CM_PX;
    if (x > w) break;
    const isMajor = i % 2 === 0;
    const tickH = isMajor ? 10 : 5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, h - tickH);
    ctx.lineTo(x, h);
    ctx.stroke();
    if (isMajor && i > 0) {
      // Labels inside content area: positive cm values
      if (x > leftMargin + 6 && x < contentEnd - 6) {
        const relCm = Math.round((x - leftMargin) / CM_PX);
        if (relCm > 0) ctx.fillText(String(relCm), x, 2);
      }
      // Labels in left margin area: negative values relative to margin
      if (x < leftMargin - 6) {
        const negCm = Math.round((x - leftMargin) / CM_PX);
        if (negCm < 0) ctx.fillText(String(negCm), x, 2);
      }
    }
  }

  // Unit label — "cm" near the left of the tick area
  ctx.textAlign = 'right';
  ctx.fillStyle = muted;
  ctx.globalAlpha = 0.55;
  ctx.fillText('cm', leftMargin - 4, 2);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';

  // Margin boundary indicators
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(leftMargin, 0);
  ctx.lineTo(leftMargin, h);
  ctx.moveTo(contentEnd, 0);
  ctx.lineTo(contentEnd, h);
  ctx.stroke();
  ctx.setLineDash([]);
}
