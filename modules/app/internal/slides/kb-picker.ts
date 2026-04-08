/** Contract: contracts/app/rules.md */

/**
 * KB picker for slides: modal dropdown that allows inserting
 * citations, entity mentions, and dataset charts from the KB.
 */

import { loadItems } from './kb-loaders.ts';

export type KbPickerMode = 'citation' | 'entity' | 'dataset';

export interface KbInsertResult {
  mode: KbPickerMode;
  id: string;
  content: string;
  type: string;
  updatedAt?: string;
}

let activePicker: HTMLElement | null = null;
let cleanupFn: (() => void) | null = null;

/** Close any open KB picker */
export function closeKbPicker(): void {
  if (activePicker) {
    activePicker.remove();
    activePicker = null;
  }
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

/** Open the KB picker with the given mode */
export function openKbPicker(
  anchor: HTMLElement,
  mode: KbPickerMode,
  onInsert: (result: KbInsertResult) => void,
): void {
  closeKbPicker();

  const panel = document.createElement('div');
  panel.className = 'kb-picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Insert from KB: ${mode}`);

  const header = buildHeader(mode);
  panel.appendChild(header);

  const searchInput = buildSearchInput(panel, mode, onInsert);
  panel.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'kb-picker__list';
  list.setAttribute('role', 'listbox');
  panel.appendChild(list);

  positionPicker(panel, anchor);
  document.body.appendChild(panel);
  activePicker = panel;
  searchInput.focus();

  loadItems(list, mode, onInsert, closeKbPicker);

  const onClickOutside = (e: MouseEvent) => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) {
      closeKbPicker();
    }
  };
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeKbPicker();
  };

  setTimeout(() => document.addEventListener('click', onClickOutside), 0);
  document.addEventListener('keydown', onEscape);
  cleanupFn = () => {
    document.removeEventListener('click', onClickOutside);
    document.removeEventListener('keydown', onEscape);
  };
}

function buildHeader(mode: KbPickerMode): HTMLElement {
  const header = document.createElement('div');
  header.className = 'kb-picker__header';
  const titles: Record<KbPickerMode, string> = {
    citation: 'Insert Citation',
    entity: 'Insert Entity',
    dataset: 'Insert Dataset Chart',
  };
  header.textContent = titles[mode];
  return header;
}

function buildSearchInput(
  panel: HTMLElement,
  mode: KbPickerMode,
  onInsert: (result: KbInsertResult) => void,
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'kb-picker__search';
  input.placeholder = `Search ${mode}s...`;

  let debounce: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const list = panel.querySelector('.kb-picker__list') as HTMLElement;
      if (list) loadItems(list, mode, onInsert, closeKbPicker, input.value.trim());
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateList(panel, e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = panel.querySelector<HTMLButtonElement>('.kb-picker__item.is-selected');
      if (active) active.click();
    }
  });

  return input;
}

function navigateList(panel: HTMLElement, direction: number): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>('.kb-picker__item'));
  if (items.length === 0) return;
  const active = panel.querySelector('.kb-picker__item.is-selected');
  let idx = active ? items.indexOf(active as HTMLElement) + direction : 0;
  idx = Math.max(0, Math.min(items.length - 1, idx));
  items.forEach((el) => el.classList.remove('is-selected'));
  items[idx].classList.add('is-selected');
  items[idx].scrollIntoView({ block: 'nearest' });
}

function positionPicker(panel: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  panel.style.position = 'fixed';
  panel.style.top = `${rect.bottom + 4}px`;
  panel.style.left = `${Math.max(8, rect.left)}px`;

  requestAnimationFrame(() => {
    const panelRect = panel.getBoundingClientRect();
    if (panelRect.right > window.innerWidth - 8) {
      panel.style.left = `${window.innerWidth - panelRect.width - 8}px`;
    }
  });
}
