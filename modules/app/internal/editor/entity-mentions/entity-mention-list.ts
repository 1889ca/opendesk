/** Contract: contracts/app/rules.md */
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { type EntityMentionItem, getSubtypeConfig } from './types.ts';

interface ListState {
  items: EntityMentionItem[];
  selectedIndex: number;
  element: HTMLDivElement | null;
  command: ((props: { id: string; label: string }) => void) | null;
}

function createState(): ListState {
  return { items: [], selectedIndex: 0, element: null, command: null };
}

function createListElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'entity-mention-dropdown';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'Entity suggestions');
  return el;
}

function renderItems(state: ListState): void {
  const el = state.element;
  if (!el) return;
  el.innerHTML = '';

  if (state.items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'entity-mention-dropdown__empty';
    empty.textContent = 'No entities found';
    el.appendChild(empty);
    return;
  }

  state.items.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.className = 'entity-mention-dropdown__item';
    if (index === state.selectedIndex) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-selected', 'true');
    }
    btn.setAttribute('role', 'option');
    btn.type = 'button';

    const config = getSubtypeConfig(item.subtype);

    const badge = document.createElement('span');
    badge.className = 'entity-mention-dropdown__badge';
    badge.style.backgroundColor = config.color;
    badge.textContent = config.icon;

    const name = document.createElement('span');
    name.className = 'entity-mention-dropdown__name';
    name.textContent = item.name;

    const subtypeLabel = document.createElement('span');
    subtypeLabel.className = 'entity-mention-dropdown__subtype';
    subtypeLabel.textContent = config.label;

    btn.appendChild(badge);
    btn.appendChild(name);
    btn.appendChild(subtypeLabel);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectItem(state, index);
    });

    el.appendChild(btn);
  });
}

function selectItem(state: ListState, index: number): void {
  const item = state.items[index];
  if (item && state.command) {
    state.command({ id: item.id, label: item.name });
  }
}

function positionDropdown(
  state: ListState,
  clientRect: (() => DOMRect | null) | null | undefined,
): void {
  const el = state.element;
  if (!el || !clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 4}px`;
}

export function entityMentionSuggestionRender() {
  const state = createState();

  return {
    onStart(props: SuggestionProps<EntityMentionItem>) {
      state.element = createListElement();
      state.items = props.items;
      state.selectedIndex = 0;
      state.command = props.command;
      renderItems(state);
      document.body.appendChild(state.element);
      positionDropdown(state, props.clientRect);
    },

    onUpdate(props: SuggestionProps<EntityMentionItem>) {
      state.items = props.items;
      state.command = props.command;
      state.selectedIndex = 0;
      renderItems(state);
      positionDropdown(state, props.clientRect);
    },

    onKeyDown(props: SuggestionKeyDownProps): boolean {
      if (state.items.length === 0) return false;
      const { event } = props;

      if (event.key === 'ArrowUp') {
        state.selectedIndex =
          (state.selectedIndex + state.items.length - 1) % state.items.length;
        renderItems(state);
        return true;
      }
      if (event.key === 'ArrowDown') {
        state.selectedIndex = (state.selectedIndex + 1) % state.items.length;
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
