/** Contract: contracts/app-kb/rules.md */

/** A KB entry result item for link suggestions. */
export interface KbLinkItem {
  id: string;
  title: string;
}

interface KbLinkListState {
  items: KbLinkItem[];
  selectedIndex: number;
  element: HTMLDivElement | null;
  onSelect: ((item: KbLinkItem) => void) | null;
}

function createState(): KbLinkListState {
  return { items: [], selectedIndex: 0, element: null, onSelect: null };
}

function createDropdownElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'kb-link-dropdown';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'KB entry suggestions');
  return el;
}

function renderItems(state: KbLinkListState): void {
  const el = state.element;
  if (!el) return;
  el.innerHTML = '';

  if (state.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'kb-link-dropdown__empty';
    empty.textContent = 'No entries found';
    el.appendChild(empty);
    return;
  }

  state.items.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = 'kb-link-dropdown__item';
    if (index === state.selectedIndex) btn.classList.add('is-selected');
    btn.setAttribute('role', 'option');
    btn.type = 'button';

    const icon = document.createElement('span');
    icon.className = 'kb-link-dropdown__icon';
    icon.textContent = '\u{1F517}';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'kb-link-dropdown__label';
    label.textContent = item.title;

    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectItem(state, index);
    });
    el.appendChild(btn);
  });
}

function selectItem(state: KbLinkListState, index: number): void {
  const item = state.items[index];
  if (item && state.onSelect) state.onSelect(item);
}

function positionDropdown(el: HTMLDivElement, anchor: { left: number; bottom: number }): void {
  el.style.left = `${anchor.left}px`;
  el.style.top = `${anchor.bottom + 4}px`;
}

/** Create and manage a KB link suggestion dropdown attached to a textarea. */
export function createKbLinkList(onSelect: (item: KbLinkItem) => void): {
  show(items: KbLinkItem[], anchor: { left: number; bottom: number }): void;
  update(items: KbLinkItem[]): void;
  hide(): void;
  handleKey(e: KeyboardEvent): boolean;
  isVisible(): boolean;
} {
  const state = createState();
  state.onSelect = onSelect;

  return {
    show(items, anchor) {
      if (!state.element) {
        state.element = createDropdownElement();
        document.body.appendChild(state.element);
      }
      state.items = items;
      state.selectedIndex = 0;
      renderItems(state);
      positionDropdown(state.element, anchor);
      state.element.hidden = false;
    },

    update(items) {
      state.items = items;
      state.selectedIndex = 0;
      if (state.element) renderItems(state);
    },

    hide() {
      if (state.element) {
        state.element.remove();
        state.element = null;
      }
      state.items = [];
    },

    handleKey(e: KeyboardEvent): boolean {
      if (!state.element || state.items.length === 0) return false;
      if (e.key === 'ArrowUp') {
        state.selectedIndex = (state.selectedIndex + state.items.length - 1) % state.items.length;
        renderItems(state);
        return true;
      }
      if (e.key === 'ArrowDown') {
        state.selectedIndex = (state.selectedIndex + 1) % state.items.length;
        renderItems(state);
        return true;
      }
      if (e.key === 'Enter') {
        selectItem(state, state.selectedIndex);
        return true;
      }
      if (e.key === 'Escape') {
        this.hide();
        return true;
      }
      return false;
    },

    isVisible(): boolean {
      return state.element !== null;
    },
  };
}
