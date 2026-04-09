/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { findEmojiByName } from '../editor/emoji/emoji-data.ts';
import { addRecentEmoji } from '../editor/emoji/emoji-recent.ts';
import {
  type AutocompleteState,
  initialState,
  getMatches,
  createDropdownManager,
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
    let state: AutocompleteState = initialState();

    function selectMatch(view: EditorView, emoji: string): void {
      addRecentEmoji(emoji);
      const { tr } = view.state;
      tr.replaceWith(state.from, state.to, view.state.schema.text(emoji));
      view.dispatch(tr);
      dropdownMgr.destroy();
      state = initialState();
      editor.commands.focus();
    }

    const dropdownMgr = createDropdownManager(selectMatch);

    function destroyAll(): void {
      dropdownMgr.destroy();
      state = initialState();
    }

    return [
      new Plugin({
        key: pluginKey,

        props: {
          handleKeyDown(view, event) {
            if (!state.active) return false;

            if (event.key === 'Escape') {
              destroyAll();
              return true;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              const matches = getMatches(state.query);
              state.selectedIndex = (state.selectedIndex + 1) % matches.length;
              dropdownMgr.render(view, state);
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              const matches = getMatches(state.query);
              state.selectedIndex =
                (state.selectedIndex - 1 + matches.length) % matches.length;
              dropdownMgr.render(view, state);
              return true;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              const matches = getMatches(state.query);
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
                if (state.active) destroyAll();
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
                  destroyAll();
                  return;
                }
              }

              state = { active: true, query, from, to, selectedIndex: 0 };
              dropdownMgr.render(view, state);
            },
            destroy() {
              destroyAll();
            },
          };
        },
      }),
    ];
  },
});
