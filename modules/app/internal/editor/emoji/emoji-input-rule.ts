/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { findEmojiByName } from './emoji-data.ts';
import { addRecentEmoji } from './emoji-recent.ts';
import {
  type AutocompleteState,
  createInitialState,
  destroyDropdown,
  getMatches,
  selectMatch,
  renderDropdown,
} from './emoji-dropdown.ts';

const pluginKey = new PluginKey('emojiAutocomplete');

/**
 * TipTap extension for :colon: emoji shortcuts with autocomplete dropdown.
 * Typing `:text` shows matching emoji suggestions; `:name:` auto-converts.
 */
export const EmojiInputRule = Extension.create({
  name: 'emojiInputRule',

  addProseMirrorPlugins() {
    const editor = this.editor;
    let state: AutocompleteState = createInitialState();

    function cleanup(): void {
      state = destroyDropdown(state);
    }

    function doSelect(view: EditorView, emoji: string): void {
      selectMatch(view, emoji, state.from, state.to, () => {
        cleanup();
        editor.commands.focus();
      });
    }

    return [
      new Plugin({
        key: pluginKey,

        props: {
          handleKeyDown(view, event) {
            if (!state.active) return false;

            if (event.key === 'Escape') {
              cleanup();
              return true;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const matches = getMatches(state.query);
              state.selectedIndex = (state.selectedIndex + 1) % matches.length;
              renderDropdown(view, state, doSelect);
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const matches = getMatches(state.query);
              state.selectedIndex =
                (state.selectedIndex - 1 + matches.length) % matches.length;
              renderDropdown(view, state, doSelect);
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              const matches = getMatches(state.query);
              if (matches.length > 0) {
                doSelect(view, matches[state.selectedIndex].emoji);
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
                if (state.active) cleanup();
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
                  cleanup();
                  return;
                }
              }

              state = { active: true, query, from, to, selectedIndex: 0 };
              renderDropdown(view, state, doSelect);
            },
            destroy() {
              cleanup();
            },
          };
        },
      }),
    ];
  },
});
