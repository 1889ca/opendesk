/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { searchEmojis, findEmojiByName } from './emoji-data.ts';
import { addRecentEmoji } from './emoji-recent.ts';

const pluginKey = new PluginKey('emojiAutocomplete');
const MAX_SUGGESTIONS = 8;

interface AutocompleteState {
  active: boolean;
  query: string;
  from: number;
  to: number;
  selectedIndex: number;
}

/**
 * TipTap extension for :colon: emoji shortcuts with autocomplete dropdown.
 * Typing `:text` shows matching emoji suggestions; `:name:` auto-converts.
 */
export const EmojiInputRule = Extension.create({
  name: 'emojiInputRule',

  addProseMirrorPlugins() {
    const editor = this.editor;
    let dropdown: HTMLElement | null = null;
    let state: AutocompleteState = {
      active: false, query: '', from: 0, to: 0, selectedIndex: 0,
    };

    function destroyDropdown(): void {
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }
      state = { active: false, query: '', from: 0, to: 0, selectedIndex: 0 };
    }

    function getMatches(): ReturnType<typeof searchEmojis> {
      return searchEmojis(state.query).slice(0, MAX_SUGGESTIONS);
    }

    function renderDropdown(view: EditorView): void {
      const matches = getMatches();
      if (matches.length === 0) {
        destroyDropdown();
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
          selectMatch(view, matches[i].emoji);
        });
        dropdown.appendChild(item);
      }

      positionDropdown(view);
    }

    function positionDropdown(view: EditorView): void {
      if (!dropdown) return;
      const coords = view.coordsAtPos(state.from);
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

    function selectMatch(view: EditorView, emoji: string): void {
      addRecentEmoji(emoji);
      const { tr } = view.state;
      tr.replaceWith(state.from, state.to, view.state.schema.text(emoji));
      view.dispatch(tr);
      destroyDropdown();
      editor.commands.focus();
    }

    return [
      new Plugin({
        key: pluginKey,

        props: {
          handleKeyDown(view, event) {
            if (!state.active) return false;

            if (event.key === 'Escape') {
              destroyDropdown();
              return true;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const matches = getMatches();
              state.selectedIndex = (state.selectedIndex + 1) % matches.length;
              renderDropdown(view);
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const matches = getMatches();
              state.selectedIndex =
                (state.selectedIndex - 1 + matches.length) % matches.length;
              renderDropdown(view);
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              const matches = getMatches();
              if (matches.length > 0) {
                selectMatch(view, matches[state.selectedIndex].emoji);
              }
              return true;
            }

            return false;
          },
        },

        view() {
          return {
            update(view) {
              const { $head } = view.state.selection;
              const textBefore = $head.parent.textBetween(
                0, $head.parentOffset, undefined, '\uFFFC',
              );

              const match = textBefore.match(/:([a-z0-9_]{1,30})$/);
              if (!match) {
                if (state.active) destroyDropdown();
                return;
              }

              const query = match[1];
              const from = $head.pos - query.length - 1;
              const to = $head.pos;

              // Check for complete :name: pattern
              const fullMatch = textBefore.match(/:([a-z0-9_]+):$/);
              if (fullMatch) {
                const entry = findEmojiByName(fullMatch[1]);
                if (entry) {
                  const replaceFrom = $head.pos - fullMatch[0].length;
                  addRecentEmoji(entry.emoji);
                  const { tr } = view.state;
                  tr.replaceWith(
                    replaceFrom, to,
                    view.state.schema.text(entry.emoji),
                  );
                  view.dispatch(tr);
                  destroyDropdown();
                  return;
                }
              }

              state = {
                active: true,
                query,
                from,
                to,
                selectedIndex: 0,
              };
              renderDropdown(view);
            },
            destroy() {
              destroyDropdown();
            },
          };
        },
      }),
    ];
  },
});
