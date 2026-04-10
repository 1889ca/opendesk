/** Contract: contracts/app/rules.md */

/**
 * Lightweight TipTap placeholder extension.
 * Shows hint text when the document is empty — no extra npm package required.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface PlaceholderOptions {
  placeholder: string;
}

const placeholderKey = new PluginKey('opendesk-placeholder');

export const Placeholder = Extension.create<PlaceholderOptions>({
  name: 'placeholder',

  addOptions() {
    return {
      placeholder: 'Start writing, or press / for commands...',
    };
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options;
    return [
      new Plugin({
        key: placeholderKey,
        props: {
          decorations(state) {
            const { doc } = state;
            // Only show when doc has a single empty paragraph
            if (
              doc.childCount !== 1 ||
              !doc.firstChild ||
              doc.firstChild.type.name !== 'paragraph' ||
              doc.firstChild.childCount !== 0
            ) {
              return DecorationSet.empty;
            }
            const deco = Decoration.node(0, doc.content.size, {
              'data-placeholder': placeholder,
              class: 'is-editor-empty',
            });
            return DecorationSet.create(doc, [deco]);
          },
        },
      }),
    ];
  },
});
