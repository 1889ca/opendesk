/** Contract: contracts/app/rules.md */
import type { EditorView } from '@tiptap/pm/view';
import { searchEmojis } from '../editor/emoji/emoji-data.ts';
import { addRecentEmoji } from '../editor/emoji/emoji-recent.ts';

const MAX_SUGGESTIONS = 8;

export interface AutocompleteState {
  active: boolean;
  query: string;
  from: number;
  to: number;
  selectedIndex: number;
}

export function initialState(): AutocompleteState {
  return { active: false, query: '', from: 0, to: 0, selectedIndex: 0 };
}

export function getMatches(query: string): ReturnType<typeof searchEmojis> {
  return searchEmojis(query).slice(0, MAX_SUGGESTIONS);
}

/**
 * Manages the emoji autocomplete dropdown lifecycle and rendering.
 */
export function createDropdownManager(onSelect: (view: EditorView, emoji: string) => void) {
  let dropdown: HTMLElement | null = null;

  function destroy(): void {
    if (dropdown) {
      dropdown.remove();
      dropdown = null;
    }
  }

  function render(view: EditorView, state: AutocompleteState): void {
    const matches = getMatches(state.query);
    if (matches.length === 0) {
      destroy();
      return;
    }

    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'emoji-autocomplete';
      dropdown.setAttribute('role', 'listbox');
      document.body.appendChild(dropdown);
    }

    dropdown.innerHTML = '';
    for (let i = 0; i < matches.length; i++) {
      const item = document.createElement('button');
      item.className = 'emoji-autocomplete__item';
      if (i === state.selectedIndex) item.classList.add('is-selected');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(i === state.selectedIndex));
      item.type = 'button';

      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'emoji-autocomplete__emoji';
      emojiSpan.textContent = matches[i].emoji;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'emoji-autocomplete__name';
      nameSpan.textContent = `:${matches[i].name}:`;

      item.appendChild(emojiSpan);
      item.appendChild(nameSpan);

      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        onSelect(view, matches[i].emoji);
      });
      dropdown.appendChild(item);
    }

    position(view, state.from);
  }

  function position(view: EditorView, from: number): void {
    if (!dropdown) return;
    const coords = view.coordsAtPos(from);
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${coords.bottom + 4}px`;
    dropdown.style.left = `${coords.left}px`;

    requestAnimationFrame(() => {
      if (!dropdown) return;
      const rect = dropdown.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        dropdown.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
    });
  }

  return { destroy, render };
}
