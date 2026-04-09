/** Contract: contracts/app/comments.md */
import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /** Apply a comment mark to an explicit range (or current selection if omitted). */
      setComment: (commentId: string, range?: { from: number; to: number }) => ReturnType;
      /** Remove a comment mark by ID from the current selection. */
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

/**
 * TipTap Mark extension for comment highlights.
 * Wraps selected text with a span containing comment metadata.
 */
export const CommentMark = Mark.create<CommentMarkOptions>({
  name: 'comment',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => ({
          'data-comment-id': attrs.commentId as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'comment-highlight',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string, range?: { from: number; to: number }) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          const { from, to } = range ?? state.selection;
          if (from === to) return false;
          if (dispatch) {
            tr.addMark(from, to, markType.create({ commentId }));
          }
          return true;
        },

      unsetComment:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;
          const markType = state.schema.marks[this.name];
          if (!markType) return false;

          state.doc.descendants((node, pos) => {
            for (const mark of node.marks) {
              if (
                mark.type === markType &&
                mark.attrs.commentId === commentId
              ) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
              }
            }
          });
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => {
        // Trigger is handled by the comment input flow in the sidebar/toolbar
        // This shortcut emits a custom event the comment system listens to
        const event = new CustomEvent('opendesk:add-comment');
        document.dispatchEvent(event);
        return true;
      },
    };
  },
});
