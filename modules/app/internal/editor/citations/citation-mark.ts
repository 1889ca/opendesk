/** Contract: contracts/app/rules.md */
import { Mark, mergeAttributes } from '@tiptap/core';
import type { CitationAttrs } from './types.ts';

export interface CitationMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citationMark: {
      /** Apply a citation mark to the current selection. */
      setCitation: (attrs: CitationAttrs) => ReturnType;
      /** Remove all citation marks from the current selection. */
      unsetCitation: () => ReturnType;
    };
  }
}

/**
 * TipTap Mark extension for inline citations.
 * Wraps selected text with a span containing reference metadata.
 */
export const CitationMark = Mark.create<CitationMarkOptions>({
  name: 'citation',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      referenceId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-reference-id'),
        renderHTML: (attrs) => ({
          'data-reference-id': attrs.referenceId as string,
        }),
      },
      locator: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-locator'),
        renderHTML: (attrs) =>
          attrs.locator ? { 'data-locator': attrs.locator as string } : {},
      },
      prefix: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-prefix'),
        renderHTML: (attrs) =>
          attrs.prefix ? { 'data-prefix': attrs.prefix as string } : {},
      },
      suffix: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-suffix'),
        renderHTML: (attrs) =>
          attrs.suffix ? { 'data-suffix': attrs.suffix as string } : {},
      },
      noteIndex: {
        default: null,
        parseHTML: (el) => {
          const val = el.getAttribute('data-note-index');
          return val ? Number(val) : null;
        },
        renderHTML: (attrs) =>
          attrs.noteIndex != null
            ? { 'data-note-index': String(attrs.noteIndex) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'citation-mark',
        'data-citation': '',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attrs: CitationAttrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),

      unsetCitation:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => {
        const event = new CustomEvent('opendesk:insert-citation');
        document.dispatchEvent(event);
        return true;
      },
    };
  },
});
