/** Contract: contracts/app/rules.md */

/**
 * Slide rendering helpers: extract element data from Yjs,
 * render slide thumbnails and the active slide viewport.
 */

import * as Y from 'yjs';
import { applyKbStyling, checkKbSourceUpdates } from './kb-elements.ts';

export type SlideElement = {
  id: string;
  type: 'text' | 'shape' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
};

/** Extract typed elements from a Yjs slide */
export function getSlideElements(
  yslides: Y.Array<Y.Map<unknown>>,
  slideIndex: number,
): SlideElement[] {
  const slide = yslides.get(slideIndex);
  if (!slide) return [];
  const elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  if (!elements) return [];
  const result: SlideElement[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements.get(i);
    result.push({
      id: el.get('id') as string,
      type: (el.get('type') as SlideElement['type']) || 'text',
      x: (el.get('x') as number) || 0,
      y: (el.get('y') as number) || 0,
      width: (el.get('width') as number) || 50,
      height: (el.get('height') as number) || 20,
      content: (el.get('content') as string) || '',
    });
  }
  return result;
}

/** Render the slide list thumbnails */
export function renderSlideList(
  slideListEl: HTMLElement,
  yslides: Y.Array<Y.Map<unknown>>,
  activeIndex: number,
  onSelect: (index: number) => void,
): void {
  slideListEl.innerHTML = '';
  for (let i = 0; i < yslides.length; i++) {
    const thumb = document.createElement('div');
    thumb.className = 'slide-thumb' + (i === activeIndex ? ' active' : '');

    const num = document.createElement('span');
    num.className = 'slide-thumb-number';
    num.textContent = String(i + 1);
    thumb.appendChild(num);

    thumb.addEventListener('click', () => onSelect(i));
    slideListEl.appendChild(thumb);
  }
}

/** Render the active slide in the viewport */
export function renderActiveSlide(
  viewportEl: HTMLElement,
  yslides: Y.Array<Y.Map<unknown>>,
  activeIndex: number,
): void {
  viewportEl.innerHTML = '';
  const slide = yslides.get(activeIndex);
  if (!slide) return;
  const yElements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  const elements = getSlideElements(yslides, activeIndex);

  for (let idx = 0; idx < elements.length; idx++) {
    const el = elements[idx];
    const div = document.createElement('div');
    div.className = 'slide-element';
    div.dataset.type = el.type;
    div.dataset.elementId = el.id;
    div.style.left = el.x + '%';
    div.style.top = el.y + '%';
    div.style.width = el.width + '%';
    div.style.height = el.height + '%';
    div.contentEditable = 'true';
    div.textContent = el.content;

    if (yElements) {
      const yel = yElements.get(idx);
      const attrs = yel?.get('attrs') as Record<string, unknown> | undefined;
      applyKbStyling(div, attrs);
      if (attrs?.kbUpdatedAt) {
        div.dataset.kbUpdatedAt = String(attrs.kbUpdatedAt);
      }
    }

    div.addEventListener('blur', () => {
      const s = yslides.get(activeIndex);
      if (!s) return;
      const els = s.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
      if (!els) return;
      for (let i = 0; i < els.length; i++) {
        const yel = els.get(i);
        if (yel.get('id') === el.id) {
          yel.set('content', div.textContent || '');
          break;
        }
      }
    });

    viewportEl.appendChild(div);
  }

  checkKbSourceUpdates(viewportEl);
}
