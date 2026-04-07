/** Contract: contracts/app/rules.md */
import type { PluginKey } from '@tiptap/pm/state';
import {
  type SearchState,
  createInitialState,
  findMatches,
  clampIndex,
} from './search-state.ts';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      find: (term: string) => ReturnType;
      findNext: () => ReturnType;
      findPrev: () => ReturnType;
      replaceMatch: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
      setSearchOption: (
        key: 'caseSensitive' | 'useRegex',
        value: boolean,
      ) => ReturnType;
    };
  }
}

/** Build the TipTap command map for search/replace. */
export function buildSearchCommands(pluginKey: PluginKey<SearchState>) {
  return {
    find:
      (term: string) =>
      ({ tr, dispatch, state }: { tr: any; dispatch?: any; state: any }) => {
        if (dispatch) {
          const prev = pluginKey.getState(state) as SearchState;
          tr.setMeta(pluginKey, {
            searchTerm: term,
            currentMatchIndex: 0,
            caseSensitive: prev?.caseSensitive ?? false,
            useRegex: prev?.useRegex ?? false,
          });
        }
        return true;
      },

    findNext:
      () =>
      ({ tr, dispatch, state }: { tr: any; dispatch?: any; state: any }) => {
        const search = pluginKey.getState(state) as SearchState;
        if (!search?.searchTerm) return false;
        const total = findMatches(state.doc, search).length;
        if (!total) return false;
        if (dispatch) {
          const nextIdx = (search.currentMatchIndex + 1) % total;
          tr.setMeta(pluginKey, { currentMatchIndex: nextIdx });
        }
        return true;
      },

    findPrev:
      () =>
      ({ tr, dispatch, state }: { tr: any; dispatch?: any; state: any }) => {
        const search = pluginKey.getState(state) as SearchState;
        if (!search?.searchTerm) return false;
        const total = findMatches(state.doc, search).length;
        if (!total) return false;
        if (dispatch) {
          const nextIdx = (search.currentMatchIndex - 1 + total) % total;
          tr.setMeta(pluginKey, { currentMatchIndex: nextIdx });
        }
        return true;
      },

    replaceMatch:
      (replacement: string) =>
      ({ tr, dispatch, state }: { tr: any; dispatch?: any; state: any }) => {
        const search = pluginKey.getState(state) as SearchState;
        if (!search?.searchTerm) return false;
        const matches = findMatches(state.doc, search);
        if (!matches.length) return false;
        const idx = clampIndex(search.currentMatchIndex, matches.length);
        const match = matches[idx];
        if (dispatch) {
          tr.insertText(replacement, match.from, match.to);
          const newTotal = matches.length - 1;
          const newIdx = newTotal > 0 ? Math.min(idx, newTotal - 1) : 0;
          tr.setMeta(pluginKey, { currentMatchIndex: newIdx });
        }
        return true;
      },

    replaceAll:
      (replacement: string) =>
      ({ tr, dispatch, state }: { tr: any; dispatch?: any; state: any }) => {
        const search = pluginKey.getState(state) as SearchState;
        if (!search?.searchTerm) return false;
        const matches = findMatches(state.doc, search);
        if (!matches.length) return false;
        if (dispatch) {
          for (let i = matches.length - 1; i >= 0; i--) {
            tr.insertText(replacement, matches[i].from, matches[i].to);
          }
          tr.setMeta(pluginKey, { currentMatchIndex: 0 });
        }
        return true;
      },

    clearSearch:
      () =>
      ({ tr, dispatch }: { tr: any; dispatch?: any }) => {
        if (dispatch) {
          tr.setMeta(pluginKey, createInitialState());
        }
        return true;
      },

    setSearchOption:
      (key: 'caseSensitive' | 'useRegex', value: boolean) =>
      ({ tr, dispatch }: { tr: any; dispatch?: any }) => {
        if (dispatch) {
          tr.setMeta(pluginKey, { [key]: value, currentMatchIndex: 0 });
        }
        return true;
      },
  };
}
