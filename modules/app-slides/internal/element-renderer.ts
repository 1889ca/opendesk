/** Contract: contracts/app-slides/rules.md */

import type { SlideElement } from './types.ts';
import { renderTextElement, type TextElementResult } from './render-text.ts';
import { renderImageElement } from './render-image.ts';
import { renderShapeElement, type ShapeElementResult } from './render-shape.ts';
import { renderTableElement } from './render-table.ts';
import type { MiniEditor } from './tiptap-mini-editor.ts';

export type ContentUpdateHandler = (elementId: string, content: string) => void;
export type StyleUpdateHandler = (elementId: string, field: string, value: unknown) => void;
export type CellUpdateHandler = (elementId: string, row: number, col: number, value: string) => void;

export type RenderResult = {
  dom: HTMLElement;
  miniEditor?: MiniEditor;
};

/** Render a slide element to a DOM node based on its type */
export function renderElement(
  el: SlideElement,
  onContentUpdate: ContentUpdateHandler,
  onStyleUpdate: StyleUpdateHandler,
  onCellUpdate: CellUpdateHandler,
): RenderResult {
  switch (el.type) {
    case 'text': {
      const result: TextElementResult = renderTextElement(
        el,
        (content) => onContentUpdate(el.id, content),
        (field, value) => onStyleUpdate(el.id, field, value),
      );
      return { dom: result.dom, miniEditor: result.miniEditor };
    }

    case 'image':
      return { dom: renderImageElement(el) };

    case 'shape': {
      const result: ShapeElementResult = renderShapeElement(
        el,
        (content) => onContentUpdate(el.id, content),
        (field, value) => onStyleUpdate(el.id, field, value),
      );
      return { dom: result.dom, miniEditor: result.miniEditor };
    }

    case 'table':
      return {
        dom: renderTableElement(el, (row, col, value) => onCellUpdate(el.id, row, col, value)),
      };

    default:
      return renderElement(
        { ...el, type: 'text' },
        onContentUpdate,
        onStyleUpdate,
        onCellUpdate,
      );
  }
}
