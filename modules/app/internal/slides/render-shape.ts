/** Contract: contracts/app/slides-element-types.md */

import type { ShapeType, SlideElement } from './types.ts';
import { createMiniEditor, applyTextStyles, TEXT_DEFAULTS, type MiniEditor } from './tiptap-mini-editor.ts';
import type { TextElementDom } from './render-text.ts';

export type ShapeElementResult = {
  dom: HTMLElement;
  miniEditor: MiniEditor;
};

/** Render a shape element using inline SVG with TipTap text overlay */
export function renderShapeElement(
  el: SlideElement,
  onTextUpdate: (content: string) => void,
  onStyleUpdate: (field: string, value: unknown) => void,
): ShapeElementResult {
  const div = document.createElement('div');
  div.className = 'slide-element slide-element--shape';
  div.dataset.type = 'shape';
  div.dataset.elementId = el.id;
  applyTransform(div, el);

  const svg = createShapeSvg(
    el.shapeType || 'rectangle',
    el.fill || '#4f87e0',
    el.stroke || '#2563eb',
    el.strokeWidth ?? 2,
  );
  div.appendChild(svg);

  // TipTap text overlay on shape
  const fontSize = el.fontSize ?? TEXT_DEFAULTS.fontSize;
  const fontColor = el.fontColor ?? TEXT_DEFAULTS.fontColor;
  const textAlign = el.textAlign ?? 'center'; // shapes default center

  const miniEditor = createMiniEditor({
    content: el.content || '',
    fontSize,
    fontColor,
    textAlign,
    onUpdate: (html) => onTextUpdate(html),
  });

  miniEditor.element.classList.add('slide-shape-text');

  div.appendChild(miniEditor.element);

  // Expose for interaction controller
  (div as TextElementDom).__styleUpdate = onStyleUpdate;
  (div as TextElementDom).__miniEditor = miniEditor;

  return { dom: div, miniEditor };
}

function createShapeSvg(
  shapeType: ShapeType,
  fill: string,
  stroke: string,
  strokeWidth: number,
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.className.baseVal = 'slide-shape-svg';

  const shape = createShapePath(shapeType, svg);
  shape.setAttribute('fill', fill);
  shape.setAttribute('stroke', stroke);
  shape.setAttribute('stroke-width', String(strokeWidth));
  svg.appendChild(shape);

  return svg;
}

function createShapePath(shapeType: ShapeType, _svg: SVGSVGElement): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';

  switch (shapeType) {
    case 'rectangle': {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '96');
      return rect;
    }
    case 'rounded-rect': {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '96');
      rect.setAttribute('height', '96');
      rect.setAttribute('rx', '12');
      rect.setAttribute('ry', '12');
      return rect;
    }
    case 'ellipse': {
      const ellipse = document.createElementNS(ns, 'ellipse');
      ellipse.setAttribute('cx', '50');
      ellipse.setAttribute('cy', '50');
      ellipse.setAttribute('rx', '48');
      ellipse.setAttribute('ry', '48');
      return ellipse;
    }
    case 'triangle': {
      const polygon = document.createElementNS(ns, 'polygon');
      polygon.setAttribute('points', '50,2 98,98 2,98');
      return polygon;
    }
    case 'arrow': {
      const polygon = document.createElementNS(ns, 'polygon');
      polygon.setAttribute('points', '0,35 65,35 65,10 100,50 65,90 65,65 0,65');
      return polygon;
    }
    case 'line': {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', '2');
      line.setAttribute('y1', '50');
      line.setAttribute('x2', '98');
      line.setAttribute('y2', '50');
      line.setAttribute('fill', 'none');
      return line;
    }
  }
}

function applyTransform(div: HTMLElement, el: SlideElement): void {
  div.style.left = `${el.x}%`;
  div.style.top = `${el.y}%`;
  div.style.width = `${el.width}%`;
  div.style.height = `${el.height}%`;
  if (el.rotation) {
    div.style.transform = `rotate(${el.rotation}deg)`;
  }
}
