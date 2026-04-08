/** Contract: contracts/app/slides-element-types.md */

import type { SlideElement } from './types.ts';
import { createMiniEditor, applyTextStyles, TEXT_DEFAULTS, type MiniEditor } from './tiptap-mini-editor.ts';

export type TextElementResult = {
  dom: HTMLElement;
  miniEditor: MiniEditor;
};

/** Render a text element with an embedded TipTap mini-editor */
export function renderTextElement(
  el: SlideElement,
  onContentUpdate: (content: string) => void,
  onStyleUpdate: (field: string, value: unknown) => void,
): TextElementResult {
  const div = document.createElement('div');
  div.className = 'slide-element slide-element--text';
  div.dataset.type = 'text';
  div.dataset.elementId = el.id;
  applyTransform(div, el);

  const fontSize = el.fontSize ?? TEXT_DEFAULTS.fontSize;
  const fontColor = el.fontColor ?? TEXT_DEFAULTS.fontColor;
  const textAlign = el.textAlign ?? TEXT_DEFAULTS.textAlign;

  const miniEditor = createMiniEditor({
    content: el.content,
    fontSize,
    fontColor,
    textAlign,
    onUpdate: (html) => onContentUpdate(html),
  });

  div.appendChild(miniEditor.element);

  // Store style update handler for toolbar use
  div.dataset.fontSize = String(fontSize);
  div.dataset.fontColor = fontColor;
  div.dataset.textAlign = textAlign;

  // Expose style updater via custom property
  (div as TextElementDom).__styleUpdate = onStyleUpdate;
  (div as TextElementDom).__miniEditor = miniEditor;

  return { dom: div, miniEditor };
}

export type TextElementDom = HTMLElement & {
  __styleUpdate?: (field: string, value: unknown) => void;
  __miniEditor?: MiniEditor;
};

function applyTransform(div: HTMLElement, el: SlideElement): void {
  div.style.left = `${el.x}%`;
  div.style.top = `${el.y}%`;
  div.style.width = `${el.width}%`;
  div.style.height = `${el.height}%`;
  if (el.rotation) {
    div.style.transform = `rotate(${el.rotation}deg)`;
  }
}

/** Update text styles on an existing text element DOM */
export function updateTextElementStyles(
  dom: HTMLElement,
  fontSize: number,
  fontColor: string,
  textAlign: string,
): void {
  const container = dom.querySelector('.slide-tiptap-container');
  if (container instanceof HTMLElement) {
    applyTextStyles(container, {
      fontSize,
      fontColor,
      textAlign: textAlign as 'left' | 'center' | 'right',
    });
  }
}
