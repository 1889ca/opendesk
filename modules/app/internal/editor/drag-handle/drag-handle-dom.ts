/** Contract: contracts/app/rules.md */

/**
 * Builds the drag handle DOM element -- a 6-dot grip icon.
 */
export function buildDragHandle(tooltip: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'drag-handle';
  el.setAttribute('draggable', 'true');
  el.setAttribute('aria-label', tooltip);
  el.setAttribute('title', tooltip);
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '-1');
  // 6-dot grip pattern (2 columns x 3 rows)
  el.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
    <circle cx="3" cy="2.5" r="1.2"/>
    <circle cx="7" cy="2.5" r="1.2"/>
    <circle cx="3" cy="8" r="1.2"/>
    <circle cx="7" cy="8" r="1.2"/>
    <circle cx="3" cy="13.5" r="1.2"/>
    <circle cx="7" cy="13.5" r="1.2"/>
  </svg>`;
  el.style.display = 'none';
  return el;
}

/**
 * Positions the handle to the left of a block node.
 */
export function positionHandle(
  handle: HTMLElement,
  blockDom: HTMLElement,
  editorDom: HTMLElement,
): void {
  const editorRect = editorDom.getBoundingClientRect();
  const blockRect = blockDom.getBoundingClientRect();
  const top = blockRect.top - editorRect.top;

  handle.style.display = 'flex';
  handle.style.top = `${top}px`;
  // Position to the left of the content padding
  handle.style.left = '-4px';
}

/**
 * Hides the drag handle.
 */
export function hideDragHandle(handle: HTMLElement): void {
  handle.style.display = 'none';
}
