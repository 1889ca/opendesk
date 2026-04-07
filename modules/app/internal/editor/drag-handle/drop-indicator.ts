/** Contract: contracts/app/rules.md */
import type { EditorView } from '@tiptap/pm/view';

/**
 * Creates the drop indicator element -- a horizontal line
 * that appears between blocks during drag.
 */
export function createDropIndicator(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'drag-drop-indicator';
  el.style.display = 'none';
  return el;
}

/**
 * Finds the nearest gap between top-level blocks and positions
 * the indicator line there.
 */
export function updateDropIndicator(
  indicator: HTMLElement,
  view: EditorView,
  clientY: number,
): void {
  const editorRect = view.dom.getBoundingClientRect();
  const doc = view.state.doc;
  let bestY = editorRect.top;
  let minDist = Infinity;

  // Check position before first block
  const firstChild = view.dom.firstElementChild;
  if (firstChild) {
    const rect = firstChild.getBoundingClientRect();
    const gapY = rect.top;
    const dist = Math.abs(clientY - gapY);
    if (dist < minDist) {
      minDist = dist;
      bestY = gapY;
    }
  }

  // Check position between and after each top-level block
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    const endPos = pos + child.nodeSize;
    const domNode = view.nodeDOM(pos);

    if (domNode instanceof HTMLElement) {
      const rect = domNode.getBoundingClientRect();
      const gapY = rect.bottom;
      const dist = Math.abs(clientY - gapY);
      if (dist < minDist) {
        minDist = dist;
        bestY = gapY;
      }
    }

    pos = endPos;
  }

  const relativeY = bestY - editorRect.top;
  indicator.style.display = 'block';
  indicator.style.top = `${relativeY}px`;
}

/**
 * Hides the drop indicator.
 */
export function hideDropIndicator(indicator: HTMLElement): void {
  indicator.style.display = 'none';
}
