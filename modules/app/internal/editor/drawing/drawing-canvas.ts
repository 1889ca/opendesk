/** Contract: contracts/app/rules.md */
/**
 * DrawingCanvas — assembles the SVG canvas, toolbar, and action bar.
 * Drawing logic: drawing-tools.ts, drawing-events.ts.
 * Toolbar UI: drawing-toolbar.ts.
 * Emits 'drawing:save' (with detail.svg) and 'drawing:cancel' on the root element.
 */

import { type DrawingShape, svgNS } from './drawing-tools.ts';
import { buildDrawingToolbar } from './drawing-toolbar.ts';
import { attachCanvasEvents } from './drawing-events.ts';

interface CanvasOptions {
  initialSvg?: string;
  width?: number;
  height?: number;
}

function loadInitialShapes(svgEl: SVGSVGElement, initialSvg: string, shapes: DrawingShape[]): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(initialSvg, 'image/svg+xml');
  const parsed = doc.querySelector('svg');
  if (!parsed) return;
  for (const child of Array.from(parsed.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'title') continue;
    if (tag === 'rect' && child.getAttribute('class') === 'drawing-bg') continue;
    const imported = document.importNode(child, true) as SVGElement;
    svgEl.appendChild(imported);
    shapes.push({ el: imported, type: 'rect' });
  }
}

export function createDrawingCanvas(options: CanvasOptions = {}): {
  root: HTMLElement;
  destroy: () => void;
} {
  const W = options.width ?? 700;
  const H = options.height ?? 480;

  const root = document.createElement('div');
  root.className = 'drawing-canvas';

  const { el: toolbarEl, state, setDeleteHandler, setClearHandler } = buildDrawingToolbar();
  root.appendChild(toolbarEl);

  // SVG canvas
  const svgEl = svgNS('svg') as SVGSVGElement;
  svgEl.setAttribute('width', String(W));
  svgEl.setAttribute('height', String(H));
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.setAttribute('class', 'drawing-svg');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', 'Drawing canvas');

  const bg = svgNS('rect');
  bg.setAttribute('width', String(W));
  bg.setAttribute('height', String(H));
  bg.setAttribute('fill', '#fff');
  bg.setAttribute('class', 'drawing-bg');
  svgEl.appendChild(bg);
  root.appendChild(svgEl);

  const shapes: DrawingShape[] = [];
  let selectedEl: SVGElement | null = null;

  if (options.initialSvg) {
    loadInitialShapes(svgEl as SVGSVGElement, options.initialSvg, shapes);
  }

  // Wire delete / clear toolbar actions
  setDeleteHandler(() => {
    if (!selectedEl) return;
    const idx = shapes.findIndex((s) => s.el === selectedEl);
    if (idx !== -1) shapes.splice(idx, 1);
    selectedEl.remove();
    selectedEl = null;
  });

  setClearHandler(() => {
    for (const s of shapes) s.el.remove();
    shapes.length = 0;
    selectedEl = null;
  });

  // Attach pointer events
  attachCanvasEvents(
    svgEl as SVGSVGElement,
    shapes,
    state,
    () => selectedEl,
    (el) => { selectedEl = el; },
  );

  // Action bar
  const actionBar = document.createElement('div');
  actionBar.className = 'drawing-action-bar';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'drawing-btn drawing-btn--cancel';
  cancelBtn.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('drawing:cancel', { bubbles: true }));
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save & Close';
  saveBtn.className = 'drawing-btn drawing-btn--save';
  saveBtn.addEventListener('click', () => {
    selectedEl?.classList.remove('drawing-selected');
    root.dispatchEvent(new CustomEvent('drawing:save', {
      bubbles: true,
      detail: { svg: svgEl.outerHTML },
    }));
  });

  actionBar.appendChild(cancelBtn);
  actionBar.appendChild(saveBtn);
  root.appendChild(actionBar);

  return {
    root,
    destroy() { root.remove(); },
  };
}
