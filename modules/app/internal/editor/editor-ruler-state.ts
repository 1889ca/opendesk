/** Contract: contracts/app/rules.md */

export const KEY = 'opendesk-ruler';
export const DEFAULT_MARGIN = 80; // px — matches editor padding: 5rem at 16px/rem

export interface RulerState {
  visible: boolean;
  left: number;
  right: number;
  tabs: number[]; // px from content-area left edge
}

export function loadState(): RulerState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      visible: s.visible !== false,
      left: typeof s.left === 'number' ? s.left : DEFAULT_MARGIN,
      right: typeof s.right === 'number' ? s.right : DEFAULT_MARGIN,
      tabs: Array.isArray(s.tabs) ? s.tabs : [],
    };
  } catch {
    return { visible: true, left: DEFAULT_MARGIN, right: DEFAULT_MARGIN, tabs: [] };
  }
}

export function saveState(s: RulerState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function applyMargins(paper: HTMLElement, s: RulerState): void {
  paper.style.paddingLeft = s.left + 'px';
  paper.style.paddingRight = s.right + 'px';
}
