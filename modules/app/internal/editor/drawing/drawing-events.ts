/** Contract: contracts/app/rules.md */
/**
 * Pointer event handlers for the SVG drawing canvas.
 * Handles pointerdown/pointermove/pointerup to create, update, and finalize shapes.
 */

import {
  type DrawingShape,
  type DrawingTool,
  svgNS,
  getSvgPoint,
  createShapeEl,
  updateShapeEl,
  isTrivialShape,
} from './drawing-tools.ts';
import type { ToolbarState } from './drawing-toolbar.ts';

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  current: SVGElement | null;
  points: string[];
}

interface SelectState {
  dx: number;
  dy: number;
}

function clearSelection(selectedEl: SVGElement | null): void {
  selectedEl?.classList.remove('drawing-selected');
}

function selectShape(el: SVGElement, prev: SVGElement | null): SVGElement {
  clearSelection(prev);
  el.classList.add('drawing-selected');
  return el;
}

/** Attach pointer event listeners to an SVG canvas element. */
export function attachCanvasEvents(
  svgEl: SVGSVGElement,
  shapes: DrawingShape[],
  state: ToolbarState,
  getSelected: () => SVGElement | null,
  setSelected: (el: SVGElement | null) => void,
): void {
  const drag: DragState = { active: false, startX: 0, startY: 0, current: null, points: [] };
  const sel: SelectState = { dx: 0, dy: 0 };

  svgEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    const { x, y } = getSvgPoint(svgEl, e);

    if (state.activeTool === 'select') {
      const target = e.target as SVGElement;
      const found = shapes.find((s) => s.el === target || s.el.contains(target));
      if (found) {
        setSelected(selectShape(found.el, getSelected()));
        sel.dx = x - parseFloat(found.el.getAttribute('cx') ?? found.el.getAttribute('x') ?? String(x));
        sel.dy = y - parseFloat(found.el.getAttribute('cy') ?? found.el.getAttribute('y') ?? String(y));
        drag.active = true;
        drag.startX = x;
        drag.startY = y;
        drag.current = found.el;
        svgEl.setPointerCapture(e.pointerId);
      } else {
        clearSelection(getSelected());
        setSelected(null);
      }
      return;
    }

    if (state.activeTool === 'text') {
      const text = prompt('Enter text:');
      if (!text) return;
      const el = svgNS('text');
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('fill', state.strokeColor);
      el.setAttribute('font-size', '16');
      el.setAttribute('font-family', 'sans-serif');
      el.textContent = text;
      svgEl.appendChild(el);
      shapes.push({ el, type: 'text' as DrawingTool });
      return;
    }

    const el = createShapeEl(state.activeTool, x, y, state.strokeColor, state.strokeWidth, state.fillColor);
    if (!el) return;
    drag.active = true;
    drag.startX = x;
    drag.startY = y;
    drag.points = [`M${x},${y}`];
    drag.current = el;
    svgEl.appendChild(el);
    shapes.push({ el, type: state.activeTool });
    svgEl.setPointerCapture(e.pointerId);
  });

  svgEl.addEventListener('pointermove', (e: PointerEvent) => {
    if (!drag.active || !drag.current) return;
    const { x, y } = getSvgPoint(svgEl, e);

    if (state.activeTool === 'select') {
      const el = drag.current;
      const tag = el.tagName;
      if (tag === 'rect' || tag === 'text') {
        el.setAttribute('x', String(x - sel.dx));
        el.setAttribute('y', String(y - sel.dy));
      } else if (tag === 'ellipse') {
        el.setAttribute('cx', String(x - sel.dx));
        el.setAttribute('cy', String(y - sel.dy));
      } else if (tag === 'line') {
        const dx2 = x - drag.startX;
        const dy2 = y - drag.startY;
        el.setAttribute('x1', String(parseFloat(el.getAttribute('x1') ?? '0') + dx2));
        el.setAttribute('y1', String(parseFloat(el.getAttribute('y1') ?? '0') + dy2));
        el.setAttribute('x2', String(parseFloat(el.getAttribute('x2') ?? '0') + dx2));
        el.setAttribute('y2', String(parseFloat(el.getAttribute('y2') ?? '0') + dy2));
        drag.startX = x;
        drag.startY = y;
      }
      return;
    }

    updateShapeEl(drag.current, state.activeTool, drag.startX, drag.startY, x, y, drag.points);
  });

  svgEl.addEventListener('pointerup', () => {
    const tool = state.activeTool;
    if (drag.current && tool !== 'select' && tool !== 'freehand' && tool !== 'text') {
      if (isTrivialShape(drag.current, tool)) {
        drag.current.remove();
        shapes.pop();
      }
    }
    drag.active = false;
    drag.current = null;
    drag.points = [];
  });
}
