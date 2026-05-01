/** Contract: contracts/app/rules.md */

/**
 * Horizontal document ruler with draggable margin handles and tab stops (#217).
 * Drag interaction logic is in editor-ruler-drag.ts.
 */

import { drawRulerTicks } from './editor-ruler-canvas.ts';
import { safeResizeObserver } from './lifecycle.ts';
import { attachTabDrag, attachMarginDrag, type RulerState } from './editor-ruler-drag.ts';

const KEY = 'opendesk-ruler';
const DEFAULT_MARGIN = 80; // px — matches editor padding: 5rem at 16px/rem

function loadState(): RulerState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      visible: s.visible === true,
      left: typeof s.left === 'number' ? s.left : DEFAULT_MARGIN,
      right: typeof s.right === 'number' ? s.right : DEFAULT_MARGIN,
      tabs: Array.isArray(s.tabs) ? s.tabs : [],
    };
  } catch {
    return { visible: false, left: DEFAULT_MARGIN, right: DEFAULT_MARGIN, tabs: [] };
  }
}

function saveState(s: RulerState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function applyMargins(paper: HTMLElement, s: RulerState): void {
  paper.style.paddingLeft = s.left + 'px';
  paper.style.paddingRight = s.right + 'px';
}

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
      attachTabDrag(el, tx, state, getPaperOffset, saveState, redraw, container);
      container.appendChild(el);
      tabEls.push(el);
    }
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

  attachMarginDrag(leftHandle, 'left', state, getPaperOffset, (s) => applyMargins(paper, s), saveState, redraw);
  attachMarginDrag(rightHandle, 'right', state, getPaperOffset, (s) => applyMargins(paper, s), saveState, redraw);

  function setVisible(v: boolean): void {
    state.visible = v;
    container.hidden = !v;
    if (toggleBtn) {
      const labelEl = document.getElementById('ruler-toggle-label');
      const label = v ? 'Hide Ruler' : 'Show Ruler';
      if (labelEl) { labelEl.textContent = label; } else { toggleBtn.textContent = label; }
      toggleBtn.setAttribute('aria-pressed', String(v));
    }
    saveState(state);
  }

  toggleBtn?.addEventListener('click', () => setVisible(!state.visible));

  applyMargins(paper, state);
  setVisible(state.visible);

  safeResizeObserver([paper, container], () => redraw());
  redraw();
}
