/** Contract: contracts/app-slides/rules.md */

import type { SlideElement, SnapGuide } from './types.ts';

const HANDLES_CONTAINER_CLASS = 'slide-interaction-handles';
const GUIDES_CONTAINER_CLASS = 'slide-snap-guides';

/** Render selection handles around selected elements */
export function renderHandles(viewport: HTMLElement, selectedElements: SlideElement[]): void {
  clearOverlays(viewport, 'handles');

  if (selectedElements.length === 0) return;

  const container = document.createElement('div');
  container.className = HANDLES_CONTAINER_CLASS;

  for (const el of selectedElements) {
    const wrapper = createSelectionBox(el);
    container.appendChild(wrapper);
  }

  viewport.appendChild(container);
}

function createSelectionBox(el: SlideElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-selection-box';
  wrapper.style.left = `${el.x}%`;
  wrapper.style.top = `${el.y}%`;
  wrapper.style.width = `${el.width}%`;
  wrapper.style.height = `${el.height}%`;
  if (el.rotation) {
    wrapper.style.transform = `rotate(${el.rotation}deg)`;
  }

  // Corner resize handles
  const corners: Array<{ pos: string; cursor: string }> = [
    { pos: 'top-left', cursor: 'nwse-resize' },
    { pos: 'top-right', cursor: 'nesw-resize' },
    { pos: 'bottom-left', cursor: 'nesw-resize' },
    { pos: 'bottom-right', cursor: 'nwse-resize' },
  ];
  for (const { pos, cursor } of corners) {
    const handle = document.createElement('div');
    handle.className = `slide-resize-handle slide-resize-handle--${pos}`;
    handle.dataset.resizeHandle = pos;
    handle.style.cursor = cursor;
    wrapper.appendChild(handle);
  }

  // Edge resize handles
  const edges: Array<{ pos: string; cursor: string }> = [
    { pos: 'top', cursor: 'ns-resize' },
    { pos: 'right', cursor: 'ew-resize' },
    { pos: 'bottom', cursor: 'ns-resize' },
    { pos: 'left', cursor: 'ew-resize' },
  ];
  for (const { pos, cursor } of edges) {
    const handle = document.createElement('div');
    handle.className = `slide-resize-handle slide-resize-handle--${pos}`;
    handle.dataset.resizeHandle = pos;
    handle.style.cursor = cursor;
    wrapper.appendChild(handle);
  }

  // Rotation handle
  const rotHandle = document.createElement('div');
  rotHandle.className = 'slide-rotate-handle';
  rotHandle.dataset.rotateHandle = 'true';
  wrapper.appendChild(rotHandle);

  return wrapper;
}

/** Render snap guide lines */
export function renderSnapGuides(viewport: HTMLElement, guides: SnapGuide[]): void {
  clearOverlays(viewport, 'snap-guides');

  if (guides.length === 0) return;

  const container = document.createElement('div');
  container.className = GUIDES_CONTAINER_CLASS;

  for (const guide of guides) {
    const line = document.createElement('div');
    line.className = `slide-snap-guide slide-snap-guide--${guide.axis}`;
    if (guide.axis === 'vertical') {
      line.style.left = `${guide.position}%`;
    } else {
      line.style.top = `${guide.position}%`;
    }
    container.appendChild(line);
  }

  viewport.appendChild(container);
}

/** Clear overlay containers */
export function clearOverlays(viewport: HTMLElement, type: 'handles' | 'snap-guides' | 'all'): void {
  if (type === 'handles' || type === 'all') {
    const handles = viewport.querySelector(`.${HANDLES_CONTAINER_CLASS}`);
    if (handles) handles.remove();
  }
  if (type === 'snap-guides' || type === 'all') {
    const guides = viewport.querySelector(`.${GUIDES_CONTAINER_CLASS}`);
    if (guides) guides.remove();
  }
}
