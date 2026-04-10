/** Contract: contracts/app/rules.md */
/**
 * Drawing tool definitions and shape-drawing helpers for the SVG canvas.
 */

export type DrawingTool = 'select' | 'rect' | 'ellipse' | 'line' | 'freehand' | 'text';

export interface DrawingShape {
  el: SVGElement;
  type: DrawingTool;
}

export const TOOL_DEFS: { id: DrawingTool; label: string; title: string }[] = [
  { id: 'select', label: '↖', title: 'Select / Move' },
  { id: 'rect', label: '▭', title: 'Rectangle' },
  { id: 'ellipse', label: '◯', title: 'Ellipse' },
  { id: 'line', label: '╱', title: 'Line' },
  { id: 'freehand', label: '✏', title: 'Freehand' },
  { id: 'text', label: 'T', title: 'Text box' },
];

export function svgNS(tag: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', tag) as SVGElement;
}

export function getSvgPoint(svgEl: SVGSVGElement, e: PointerEvent): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: Math.round(e.clientX - rect.left),
    y: Math.round(e.clientY - rect.top),
  };
}

export function applyStrokeAttrs(
  el: SVGElement,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
): void {
  el.setAttribute('stroke', strokeColor);
  el.setAttribute('stroke-width', String(strokeWidth));
  el.setAttribute('fill', fillColor);
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
}

/** Create a new shape element for the given tool, applying initial attributes. */
export function createShapeEl(
  tool: DrawingTool,
  x: number,
  y: number,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
): SVGElement | null {
  if (tool === 'rect') {
    const el = svgNS('rect');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.setAttribute('width', '0');
    el.setAttribute('height', '0');
    applyStrokeAttrs(el, strokeColor, strokeWidth, fillColor);
    return el;
  }
  if (tool === 'ellipse') {
    const el = svgNS('ellipse');
    el.setAttribute('cx', String(x));
    el.setAttribute('cy', String(y));
    el.setAttribute('rx', '0');
    el.setAttribute('ry', '0');
    applyStrokeAttrs(el, strokeColor, strokeWidth, fillColor);
    return el;
  }
  if (tool === 'line') {
    const el = svgNS('line');
    el.setAttribute('x1', String(x));
    el.setAttribute('y1', String(y));
    el.setAttribute('x2', String(x));
    el.setAttribute('y2', String(y));
    el.setAttribute('stroke', strokeColor);
    el.setAttribute('stroke-width', String(strokeWidth));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('fill', 'none');
    return el;
  }
  if (tool === 'freehand') {
    const el = svgNS('path');
    el.setAttribute('d', `M${x},${y}`);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', strokeColor);
    el.setAttribute('stroke-width', String(strokeWidth));
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    return el;
  }
  return null;
}

/** Update an in-progress shape during pointer move. */
export function updateShapeEl(
  el: SVGElement,
  tool: DrawingTool,
  startX: number,
  startY: number,
  x: number,
  y: number,
  points: string[],
): void {
  if (tool === 'rect') {
    el.setAttribute('x', String(Math.min(x, startX)));
    el.setAttribute('y', String(Math.min(y, startY)));
    el.setAttribute('width', String(Math.abs(x - startX)));
    el.setAttribute('height', String(Math.abs(y - startY)));
  } else if (tool === 'ellipse') {
    el.setAttribute('rx', String(Math.abs(x - startX) / 2));
    el.setAttribute('ry', String(Math.abs(y - startY) / 2));
    el.setAttribute('cx', String((x + startX) / 2));
    el.setAttribute('cy', String((y + startY) / 2));
  } else if (tool === 'line') {
    el.setAttribute('x2', String(x));
    el.setAttribute('y2', String(y));
  } else if (tool === 'freehand') {
    points.push(`L${x},${y}`);
    el.setAttribute('d', points.join(' '));
  }
}

/** Returns true if a shape should be removed (too small to be useful). */
export function isTrivialShape(el: SVGElement, tool: DrawingTool): boolean {
  if (tool === 'line') {
    const len = Math.hypot(
      parseFloat(el.getAttribute('x2') ?? '0') - parseFloat(el.getAttribute('x1') ?? '0'),
      parseFloat(el.getAttribute('y2') ?? '0') - parseFloat(el.getAttribute('y1') ?? '0'),
    );
    return len < 3;
  }
  const w = parseFloat(el.getAttribute('width') ?? el.getAttribute('rx') ?? '0');
  const h = parseFloat(el.getAttribute('height') ?? el.getAttribute('ry') ?? '0');
  return w < 2 && h < 2;
}
