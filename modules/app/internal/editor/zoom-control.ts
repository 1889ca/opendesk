/** Contract: contracts/app/rules.md */

/**
 * Zoom control — step-based zoom for the editor canvas (#265).
 * Persists zoom level in localStorage and applies via CSS custom property.
 */

const ZOOM_KEY = 'opendesk-zoom';
const STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200];

export function initZoomControl(): void {
  const levelEl = document.getElementById('zoom-level');
  const zoomInBtn = document.getElementById('zoom-in') as HTMLButtonElement | null;
  const zoomOutBtn = document.getElementById('zoom-out') as HTMLButtonElement | null;
  if (!levelEl || !zoomInBtn || !zoomOutBtn) return;

  const saved = parseInt(localStorage.getItem(ZOOM_KEY) || '100', 10);
  let currentIdx = STEPS.indexOf(saved);
  if (currentIdx === -1) currentIdx = STEPS.indexOf(100);

  function applyZoom(): void {
    const pct = STEPS[currentIdx];
    document.body.style.setProperty('--editor-zoom', String(pct / 100));
    levelEl!.textContent = `${pct}%`;
    localStorage.setItem(ZOOM_KEY, String(pct));
    zoomInBtn!.disabled = currentIdx >= STEPS.length - 1;
    zoomOutBtn!.disabled = currentIdx <= 0;
  }

  zoomInBtn.addEventListener('click', () => {
    if (currentIdx < STEPS.length - 1) { currentIdx++; applyZoom(); }
  });
  zoomOutBtn.addEventListener('click', () => {
    if (currentIdx > 0) { currentIdx--; applyZoom(); }
  });

  applyZoom();
}
