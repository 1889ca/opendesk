/** Contract: contracts/app/rules.md */
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { SlashCommand } from './slash-commands-data.ts';

interface SlashListState {
  items: SlashCommand[];
  selectedIndex: number;
  element: HTMLDivElement | null;
  command: ((props: { id: string; label: string }) => void) | null;
}

function createState(): SlashListState {
  return { items: [], selectedIndex: 0, element: null, command: null };
}

function createListElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'slash-command-list';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'Commands');
  return el;
}

function renderItems(state: SlashListState): void {
  const el = state.element;
  if (!el) return;

  el.innerHTML = '';

  if (state.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'slash-command-empty';
    empty.textContent = 'No commands found';
    el.appendChild(empty);
    return;
  }

  let lastCategory = '';

  state.items.forEach((cmd, index) => {
    if (cmd.category !== lastCategory) {
      const heading = document.createElement('div');
      heading.className = 'slash-command-category';
      heading.textContent = cmd.category;
      el.appendChild(heading);
      lastCategory = cmd.category;
    }

    const item = document.createElement('button');
    item.className = 'slash-command-item';
    if (index === state.selectedIndex) {
      item.classList.add('is-selected');
      item.setAttribute('aria-selected', 'true');
    }
    item.setAttribute('role', 'option');
    item.type = 'button';

    const labelEl = document.createElement('span');
    labelEl.className = 'slash-command-label';
    labelEl.textContent = cmd.label;

    const descEl = document.createElement('span');
    descEl.className = 'slash-command-desc';
    descEl.textContent = cmd.description;

    const textWrap = document.createElement('span');
    textWrap.className = 'slash-command-text';
    textWrap.appendChild(labelEl);
    textWrap.appendChild(descEl);

    item.appendChild(textWrap);

    if (cmd.shortcut) {
      const shortcutEl = document.createElement('span');
      shortcutEl.className = 'slash-command-shortcut';
      shortcutEl.textContent = cmd.shortcut;
      item.appendChild(shortcutEl);
    }

    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectItem(state, index);
    });

    el.appendChild(item);
  });
}

function selectItem(state: SlashListState, index: number): void {
  const cmd = state.items[index];
  if (cmd && state.command) {
    state.command({ id: cmd.id, label: cmd.label });
  }
}

function positionDropdown(
  state: SlashListState,
  clientRect: (() => DOMRect | null) | null | undefined,
): void {
  const el = state.element;
  if (!el || !clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 4}px`;
}

export function slashCommandSuggestionRender() {
  const state = createState();

  return {
    onStart(props: SuggestionProps<SlashCommand>) {
      state.element = createListElement();
      state.items = props.items;
      state.selectedIndex = 0;
      state.command = props.command;
      renderItems(state);
      document.body.appendChild(state.element);
      positionDropdown(state, props.clientRect);
    },

    onUpdate(props: SuggestionProps<SlashCommand>) {
      state.items = props.items;
      state.command = props.command;
      state.selectedIndex = 0;
      renderItems(state);
      positionDropdown(state, props.clientRect);
    },

    onKeyDown(props: SuggestionKeyDownProps): boolean {
      const { event } = props;

      if (event.key === 'ArrowUp') {
        const len = state.items.length;
        if (len === 0) return false;
        state.selectedIndex = (state.selectedIndex + len - 1) % len;
        renderItems(state);
        return true;
      }

      if (event.key === 'ArrowDown') {
        const len = state.items.length;
        if (len === 0) return false;
        state.selectedIndex = (state.selectedIndex + 1) % len;
        renderItems(state);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(state, state.selectedIndex);
        return true;
      }

      if (event.key === 'Escape') {
        return true;
      }

      return false;
    },

    onExit() {
      if (state.element) {
        state.element.remove();
        state.element = null;
      }
      state.items = [];
      state.command = null;
    },
  };
}
