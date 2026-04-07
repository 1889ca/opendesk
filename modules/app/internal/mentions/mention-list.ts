/** Contract: contracts/app/rules.md */
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { t } from '../i18n/index.ts';

export interface MentionUser {
  id: string;
  label: string;
  color: string;
}

interface MentionListState {
  items: MentionUser[];
  selectedIndex: number;
  element: HTMLDivElement | null;
  command: ((props: { id: string; label: string }) => void) | null;
}

const state: MentionListState = {
  items: [],
  selectedIndex: 0,
  element: null,
  command: null,
};

function createListElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'mention-dropdown';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'User suggestions');
  return el;
}

function renderItems(): void {
  const el = state.element;
  if (!el) return;

  el.innerHTML = '';

  if (state.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'mention-dropdown__empty';
    empty.textContent = t('mentions.noResults');
    el.appendChild(empty);
    return;
  }

  state.items.forEach((user, index) => {
    const item = document.createElement('button');
    item.className = 'mention-dropdown__item';
    if (index === state.selectedIndex) {
      item.classList.add('is-selected');
      item.setAttribute('aria-selected', 'true');
    }
    item.setAttribute('role', 'option');
    item.type = 'button';

    const dot = document.createElement('span');
    dot.className = 'mention-dropdown__dot';
    dot.style.backgroundColor = user.color;

    const name = document.createElement('span');
    name.className = 'mention-dropdown__name';
    name.textContent = user.label;

    item.appendChild(dot);
    item.appendChild(name);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectItem(index);
    });

    el.appendChild(item);
  });
}

function selectItem(index: number): void {
  const item = state.items[index];
  if (item && state.command) {
    state.command({ id: item.id, label: item.label });
  }
}

function positionDropdown(
  clientRect: (() => DOMRect | null) | null | undefined,
): void {
  const el = state.element;
  if (!el || !clientRect) return;

  const rect = clientRect();
  if (!rect) return;

  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 4}px`;
}

export function mentionSuggestionRender() {
  return {
    onStart(props: SuggestionProps<MentionUser>) {
      state.element = createListElement();
      state.items = props.items;
      state.selectedIndex = 0;
      state.command = props.command;

      renderItems();
      document.body.appendChild(state.element);
      positionDropdown(props.clientRect);
    },

    onUpdate(props: SuggestionProps<MentionUser>) {
      state.items = props.items;
      state.command = props.command;
      state.selectedIndex = 0;
      renderItems();
      positionDropdown(props.clientRect);
    },

    onKeyDown(props: SuggestionKeyDownProps): boolean {
      const { event } = props;

      if (event.key === 'ArrowUp') {
        state.selectedIndex =
          (state.selectedIndex + state.items.length - 1) % state.items.length;
        renderItems();
        return true;
      }

      if (event.key === 'ArrowDown') {
        state.selectedIndex = (state.selectedIndex + 1) % state.items.length;
        renderItems();
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(state.selectedIndex);
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
