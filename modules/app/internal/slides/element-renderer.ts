/** Contract: contracts/app/slides-element-types.md */

import type { SlideElement } from './types.ts';
import { renderTextElement } from './render-text.ts';
import { renderImageElement } from './render-image.ts';
import { renderShapeElement } from './render-shape.ts';
import { renderTableElement } from './render-table.ts';

export type ContentUpdateHandler = (elementId: string, content: string) => void;
export type CellUpdateHandler = (elementId: string, row: number, col: number, value: string) => void;

/** Render a slide element to a DOM node based on its type */
export function renderElement(
  el: SlideElement,
  onContentUpdate: ContentUpdateHandler,
  onCellUpdate: CellUpdateHandler,
): HTMLElement {
  switch (el.type) {
    case 'text':
      return renderTextElement(el, (content) => onContentUpdate(el.id, content));

    case 'image':
      return renderImageElement(el);

    case 'shape':
      return renderShapeElement(el, (content) => onContentUpdate(el.id, content));

    case 'table':
      return renderTableElement(el, (row, col, value) => onCellUpdate(el.id, row, col, value));

    default:
      return renderTextElement(el, (content) => onContentUpdate(el.id, content));
  }
}
