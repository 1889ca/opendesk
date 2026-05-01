/** Contract: contracts/app/rules.md */
/**
 * Ruler drag-interaction helpers: tab stop drag and margin handle drag.
 * Extracted from editor-ruler.ts to keep files under 200 lines.
 */

export interface RulerState {
  visible: boolean;
  left: number;
  right: number;
  tabs: number[];
}

export type GetPaperOffset = () => { left: number; width: number };

/**
 * Attach drag-to-move (and drag-off-ruler-to-delete) behaviour to a tab stop element.
 */
export function attachTabDrag(
  el: HTMLElement,
  tabX: number,
  state: RulerState,
  getPaperOffset: GetPaperOffset,
  saveState: (s: RulerState) => void,
  redraw: () => void,
  container: HTMLElement,
): void {
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const idx = state.tabs.indexOf(tabX);
    const { left: offset, width: pw } = getPaperOffset();
    const contentWidth = pw - state.left - state.right;

    const onMove = (me: MouseEvent): void => {
      const dx = me.clientX - startClientX;
      const newX = Math.max(0, Math.min(contentWidth, tabX + dx));
      el.style.left = (offset + state.left + newX) + 'px';
      if (idx >= 0) state.tabs[idx] = Math.round(newX);
    };

    const onUp = (me: MouseEvent): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const cr = container.getBoundingClientRect();
      if (me.clientY < cr.top - 16 || me.clientY > cr.bottom + 16) {
        if (idx >= 0) state.tabs.splice(idx, 1);
      }
      saveState(state);
      redraw();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/**
 * Attach drag behaviour to a margin handle (left or right).
 */
export function attachMarginDrag(
  handle: HTMLElement,
  side: 'left' | 'right',
  state: RulerState,
  getPaperOffset: GetPaperOffset,
  applyMargins: (s: RulerState) => void,
  saveState: (s: RulerState) => void,
  redraw: () => void,
): void {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMargin = side === 'left' ? state.left : state.right;
    const { width: pw } = getPaperOffset();

    const onMove = (me: MouseEvent): void => {
      const dx = me.clientX - startX;
      const delta = side === 'left' ? dx : -dx;
      const newM = Math.max(16, Math.min(pw / 2 - 32, startMargin + delta));
      if (side === 'left') state.left = Math.round(newM);
      else state.right = Math.round(newM);
      applyMargins(state);
      redraw();
    };

    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveState(state);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
