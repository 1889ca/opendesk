/** Contract: contracts/app/slides-element-types.md */

import type { SlideElement } from './types.ts';

/** Render a text element as a contentEditable div */
export function renderTextElement(el: SlideElement, onBlur: (content: string) => void): HTMLElement {
  const div = document.createElement('div');
  div.className = 'slide-element';
  div.dataset.type = 'text';
  div.dataset.elementId = el.id;
  applyTransform(div, el);
  div.contentEditable = 'true';
  div.textContent = el.content;

  div.addEventListener('blur', () => {
    onBlur(div.textContent || '');
  });

  return div;
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
