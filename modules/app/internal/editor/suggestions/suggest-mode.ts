/** Contract: contracts/app/suggestions.md */
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import type { SuggestionAttrs } from './types.ts';

export const suggestModeKey = new PluginKey('suggestMode');

type UserProvider = () => { name: string; color: string };

let suggesting = false;
let getUserFn: UserProvider = () => ({ name: 'Unknown', color: '#999' });

/** Check whether suggest mode is active. */
export function isSuggesting(): boolean {
  return suggesting;
}

/** Toggle suggest mode on/off. */
export function setSuggesting(value: boolean): void {
  suggesting = value;
  document.dispatchEvent(new CustomEvent('opendesk:suggest-mode-changed'));
}

/** Set the user provider for suggestion attrs. */
export function setSuggestUser(fn: UserProvider): void {
  getUserFn = fn;
}

/** Build suggestion attrs for the current user. */
export function buildSuggestionAttrs(): SuggestionAttrs {
  const user = getUserFn();
  return {
    suggestionId: crypto.randomUUID(),
    authorId: user.name.toLowerCase().replace(/\s+/g, '-'),
    authorName: user.name,
    authorColor: user.color,
    createdAt: new Date().toISOString(),
  };
}

/**
 * ProseMirror plugin that intercepts typing and deletion in suggest mode.
 * - Typed text gets wrapped with suggestionInsert marks
 * - Deleted text gets wrapped with suggestionDelete marks instead of removal
 */
export function createSuggestModePlugin(editor: Editor): Plugin {
  return new Plugin({
    key: suggestModeKey,

    props: {
      handleTextInput(view, from, to, text) {
        if (!suggesting) return false;

        const { state } = view;
        const attrs = buildSuggestionAttrs();
        const markType = state.schema.marks.suggestionInsert;
        if (!markType) return false;

        const mark = markType.create(attrs);
        let tr = state.tr;

        // If there's a selection, mark the selected text as deleted first
        if (from !== to) {
          const delMarkType = state.schema.marks.suggestionDelete;
          if (delMarkType) {
            const delMark = delMarkType.create(attrs);
            tr = tr.addMark(from, to, delMark);
          }
        }

        // Insert new text with insert mark after the selection
        tr = tr.insertText(text, to);
        tr = tr.addMark(to, to + text.length, mark);
        view.dispatch(tr);
        return true;
      },

      handleKeyDown(view, event) {
        if (!suggesting) return false;

        const isBackspace = event.key === 'Backspace';
        const isDelete = event.key === 'Delete';
        if (!isBackspace && !isDelete) return false;

        const { state } = view;
        const { from, to, empty } = state.selection;
        const delMarkType = state.schema.marks.suggestionDelete;
        if (!delMarkType) return false;

        // Check if we're inside a suggestionInsert mark — if so, allow
        // normal deletion (removing the suggested insert text)
        if (empty) {
          const insMarkType = state.schema.marks.suggestionInsert;
          const resolvedPos = state.doc.resolve(from);
          const marks = resolvedPos.marks();
          const hasInsert = marks.some((m) => m.type === insMarkType);
          if (hasInsert) return false;
        }

        const attrs = buildSuggestionAttrs();
        const mark = delMarkType.create(attrs);
        let tr = state.tr;

        if (!empty) {
          tr = tr.addMark(from, to, mark);
        } else if (isBackspace && from > 0) {
          tr = tr.addMark(from - 1, from, mark);
          tr = tr.setSelection(
            Selection.near(tr.doc.resolve(from - 1)),
          );
        } else if (isDelete && from < state.doc.content.size) {
          tr = tr.addMark(from, from + 1, mark);
        } else {
          return false;
        }

        view.dispatch(tr);
        return true;
      },
    },
  });
}
