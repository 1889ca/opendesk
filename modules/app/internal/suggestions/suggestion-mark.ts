/** Contract: contracts/app/suggestions.md */
import { Mark, mergeAttributes } from '@tiptap/core';

/**
 * Shared attributes for both suggestion mark types.
 * These attrs are synced via Yjs as part of the document state.
 */
function suggestionAttributes() {
  return {
    suggestionId: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-suggestion-id'),
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-suggestion-id': attrs.suggestionId as string,
      }),
    },
    authorId: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-author-id'),
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-author-id': attrs.authorId as string,
      }),
    },
    authorName: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-author-name'),
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-author-name': attrs.authorName as string,
      }),
    },
    authorColor: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-author-color'),
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-author-color': attrs.authorColor as string,
      }),
    },
    createdAt: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute('data-created-at'),
      renderHTML: (attrs: Record<string, unknown>) => ({
        'data-created-at': attrs.createdAt as string,
      }),
    },
  };
}

/** Mark for suggested insertions (new text, shown with underline + green). */
export const SuggestionInsertMark = Mark.create({
  name: 'suggestionInsert',

  addAttributes() {
    return suggestionAttributes();
  },

  parseHTML() {
    return [{ tag: 'span[data-suggestion-insert]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-suggestion-insert': '',
        class: 'suggestion-insert',
      }),
      0,
    ];
  },
});

/** Mark for suggested deletions (removed text, shown with strikethrough + red). */
export const SuggestionDeleteMark = Mark.create({
  name: 'suggestionDelete',

  addAttributes() {
    return suggestionAttributes();
  },

  parseHTML() {
    return [{ tag: 'span[data-suggestion-delete]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-suggestion-delete': '',
        class: 'suggestion-delete',
      }),
      0,
    ];
  },
});
