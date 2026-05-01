/** Contract: contracts/app-slides/rules.md */

import type { SlideElement } from './types.ts';

/** Invariant 11: only http(s) or /uploads/ relative paths are safe to assign as image src */
function isSafeSrc(src: string): boolean {
  return /^https?:\/\//.test(src) || src.startsWith('/uploads/');
}

/** Render an image element */
export function renderImageElement(el: SlideElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'slide-element slide-element--image';
  div.dataset.type = 'image';
  div.dataset.elementId = el.id;
  applyTransform(div, el);

  const src = el.src && isSafeSrc(el.src) ? el.src : null;
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = el.content || 'Slide image';
    img.draggable = false;
    img.className = 'slide-image-content';
    div.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'slide-image-placeholder';
    placeholder.textContent = 'No image';
    div.appendChild(placeholder);
  }

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
