/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import {
  type SearchState,
  createInitialState,
  findMatches,
  clampIndex,
} from './search-state.ts';
import { buildSearchCommands } from './search-commands.ts';

export const searchPluginKey = new PluginKey<SearchState>('opendesk-search');

/** Build decorations for all matches, highlighting the current one. */
function buildDecorations(
  state: EditorState,
  search: SearchState,
): DecorationSet {
  if (!search.searchTerm) return DecorationSet.empty;

  const matches = findMatches(state.doc, search);
  const decorations: Decoration[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { from, to } = matches[i];
    const cls =
      i === search.currentMatchIndex
        ? 'search-match search-match--current'
        : 'search-match';
    decorations.push(Decoration.inline(from, to, { class: cls }));
  }

  return DecorationSet.create(state.doc, decorations);
}

/** Scroll the current match into view. */
function scrollToMatch(view: EditorView, search: SearchState): void {
  const matches = findMatches(view.state.doc, search);
  if (!matches.length) return;
  const match = matches[clampIndex(search.currentMatchIndex, matches.length)];
  if (!match) return;

  const dom = view.domAtPos(match.from);
  const el = dom.node instanceof HTMLElement
    ? dom.node
    : dom.node.parentElement;
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export const SearchExtension = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    const plugin = new Plugin<SearchState>({
      key: searchPluginKey,
      state: {
        init: () => createInitialState(),
        apply(tr, prev) {
          const meta = tr.getMeta(searchPluginKey) as
            | Partial<SearchState>
            | undefined;
          if (meta) return { ...prev, ...meta };
          return prev;
        },
      },
      props: {
        decorations(state) {
          const search = this.getState(state);
          if (!search) return DecorationSet.empty;
          return buildDecorations(state, search);
        },
      },
    });
    return [plugin];
  },

  addCommands() {
    return buildSearchCommands(searchPluginKey);
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        document.dispatchEvent(new CustomEvent('opendesk:open-search'));
        return true;
      },
      'Mod-h': () => {
        document.dispatchEvent(
          new CustomEvent('opendesk:open-search', {
            detail: { showReplace: true },
          }),
        );
        return true;
      },
    };
  },

  onTransaction({ editor }) {
    const state = searchPluginKey.getState(editor.state) as SearchState;
    if (!state?.searchTerm) return;

    const matches = findMatches(editor.state.doc, state);
    document.dispatchEvent(
      new CustomEvent('opendesk:search-update', {
        detail: {
          totalMatches: matches.length,
          currentMatchIndex: clampIndex(
            state.currentMatchIndex,
            matches.length,
          ),
        },
      }),
    );
    scrollToMatch(editor.view, state);
  },
});
