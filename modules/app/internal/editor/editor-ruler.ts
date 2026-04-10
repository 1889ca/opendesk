/** Contract: contracts/app/rules.md */

/**
 * Horizontal document ruler with draggable margin handles and tab stops (#217).
 * Positioned between the formatting toolbar and the editor canvas in the DOM flow.
 * State is persisted in localStorage.
 */

import { drawRulerTicks } from './editor-ruler-canvas.ts';
import { loadState, saveState, applyMargins, type RulerState } from './editor-ruler-state.ts';

function buildHandle(side: 'left' | 'right'): HTMLElement {
  const el = document.createElement('div');
  el.className = `ruler-handle ruler-handle--${side}`;
  el.title = `Drag to adjust ${side} margin`;
  return el;
}

function buildTabMarker(xAbs: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ruler-tab-stop';
  el.style.left = xAbs + 'px';
  el.title = 'Tab stop — drag off ruler to remove';
  return el;
}

export function initRuler(): void {
  const containerEl = document.getElementById('ruler-h');
  const paperEl = document.getElementById('editor');
  const toggleBtn = document.getElementById('ruler-toggle');
  if (!containerEl || !paperEl) return;
  const container: HTMLElement = containerEl;
  const paper: HTMLElement = paperEl;

  const state = loadState();

  const canvas = document.createElement('canvas');
  canvas.className = 'ruler-canvas';
  canvas.style.cssText = 'position:absolute;top:0;height:100%;pointer-events:auto;';

  const leftHandle = buildHandle('left');
  const rightHandle = buildHandle('right');

  container.append(canvas, leftHandle, rightHandle);

  const tabEls: HTMLElement[] = [];

  function getPaperOffset(): { left: number; width: number } {
    const pr = paper.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    return { left: pr.left - cr.left, width: pr.width };
  }

  function redraw(): void {
    const { left: offset, width: pw } = getPaperOffset();

    canvas.style.left = offset + 'px';
    canvas.style.width = pw + 'px';
    drawRulerTicks(canvas, pw, state.left, state.right);

    leftHandle.style.left = (offset + state.left - 5) + 'px';
    rightHandle.style.left = (offset + pw - state.right - 5) + 'px';

    // Re-render tab stops
    tabEls.forEach((el) => el.remove());
    tabEls.length = 0;
    for (const tx of state.tabs) {
      const el = buildTabMarker(offset + state.left + tx);
      attachTabDrag(el, tx);
      container.appendChild(el);
      tabEls.push(el);
    }
  }

  function attachTabDrag(el: HTMLElement, tabX: number): void {
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

  // Click on canvas to add a tab stop
  canvas.addEventListener('click', (e) => {
    const cr = container.getBoundingClientRect();
    const { left: offset } = getPaperOffset();
    const xInContent = e.clientX - cr.left - offset - state.left;
    const { width: pw } = getPaperOffset();
    if (xInContent < 0 || xInContent > pw - state.left - state.right) return;
    state.tabs.push(Math.round(xInContent));
    saveState(state);
    redraw();
  });

  function attachMarginDrag(handle: HTMLElement, side: 'left' | 'right'): void {
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
        applyMargins(paper, state);
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

  attachMarginDrag(leftHandle, 'left');
  attachMarginDrag(rightHandle, 'right');

  function setVisible(v: boolean): void {
    state.visible = v;
    container.hidden = !v;
    if (toggleBtn) {
      toggleBtn.textContent = v ? 'Hide Ruler' : 'Show Ruler';
      toggleBtn.setAttribute('aria-pressed', String(v));
    }
    saveState(state);
  }

  toggleBtn?.addEventListener('click', () => setVisible(!state.visible));

  applyMargins(paper, state);
  setVisible(state.visible);

  const ro = new ResizeObserver(redraw);
  ro.observe(paper);
  ro.observe(container);
  redraw();
}
