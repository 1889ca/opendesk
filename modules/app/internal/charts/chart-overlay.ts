/** Contract: contracts/app/charts.md */
import type { ChartDef, ChartPosition, ChartSize } from './chart-types.ts';

export interface OverlayCallbacks {
  onMove: (id: string, pos: ChartPosition) => void;
  onResize: (id: string, size: ChartSize) => void;
  onDelete: (id: string) => void;
}

const HANDLE_SIZE = 10;

export function createChartOverlay(
  container: HTMLElement,
  chart: ChartDef,
  callbacks: OverlayCallbacks,
): { el: HTMLElement; canvas: HTMLCanvasElement; destroy: () => void } {
  const el = document.createElement('div');
  el.className = 'chart-overlay';
  el.dataset.chartId = chart.id;
  applyPosition(el, chart.position, chart.size);

  // Header bar
  const header = document.createElement('div');
  header.className = 'chart-overlay-header';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'chart-overlay-title';
  titleSpan.textContent = chart.title || chart.type + ' chart';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'chart-overlay-delete';
  deleteBtn.textContent = '\u00d7';
  deleteBtn.title = 'Delete chart';
  deleteBtn.addEventListener('click', () => callbacks.onDelete(chart.id));

  header.appendChild(titleSpan);
  header.appendChild(deleteBtn);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'chart-canvas';
  canvas.width = chart.size.width;
  canvas.height = chart.size.height - 28;

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'chart-resize-handle';

  el.appendChild(header);
  el.appendChild(canvas);
  el.appendChild(handle);

  // Drag
  const cleanupDrag = setupDrag(header, el, chart, callbacks);

  // Resize
  const cleanupResize = setupResize(handle, el, canvas, chart, callbacks);

  container.appendChild(el);

  return {
    el,
    canvas,
    destroy() {
      cleanupDrag();
      cleanupResize();
      el.remove();
    },
  };
}

function applyPosition(el: HTMLElement, pos: ChartPosition, size: ChartSize) {
  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';
  el.style.width = size.width + 'px';
  el.style.height = size.height + 'px';
}

function setupDrag(
  grip: HTMLElement,
  el: HTMLElement,
  chart: ChartDef,
  cb: OverlayCallbacks,
): () => void {
  let startX = 0, startY = 0, origX = 0, origY = 0;

  function onDown(e: MouseEvent) {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    origX = chart.position.x; origY = chart.position.y;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e: MouseEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    chart.position.x = Math.max(0, origX + dx);
    chart.position.y = Math.max(0, origY + dy);
    el.style.left = chart.position.x + 'px';
    el.style.top = chart.position.y + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    cb.onMove(chart.id, { ...chart.position });
  }

  grip.addEventListener('mousedown', onDown);
  return () => grip.removeEventListener('mousedown', onDown);
}

function setupResize(
  handle: HTMLElement,
  el: HTMLElement,
  canvas: HTMLCanvasElement,
  chart: ChartDef,
  cb: OverlayCallbacks,
): () => void {
  let startX = 0, startY = 0, origW = 0, origH = 0;

  function onDown(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    startX = e.clientX; startY = e.clientY;
    origW = chart.size.width; origH = chart.size.height;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function onMove(e: MouseEvent) {
    chart.size.width = Math.max(200, origW + e.clientX - startX);
    chart.size.height = Math.max(150, origH + e.clientY - startY);
    el.style.width = chart.size.width + 'px';
    el.style.height = chart.size.height + 'px';
    canvas.width = chart.size.width;
    canvas.height = chart.size.height - 28;
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    cb.onResize(chart.id, { ...chart.size });
  }

  handle.addEventListener('mousedown', onDown);
  return () => handle.removeEventListener('mousedown', onDown);
}
