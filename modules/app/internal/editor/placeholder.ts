/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const PLACEHOLDER_TEXT = "Start typing, or press '/' for commands\u2026";
const pluginKey = new PluginKey('placeholder');

function isDocEmpty(doc: import('@tiptap/pm/model').Node): boolean {
  return (
    doc.childCount === 1 &&
    doc.firstChild !== null &&
    doc.firstChild.isTextblock &&
    doc.firstChild.content.size === 0
  );
}

/**
 * Placeholder — shows a hint on the first paragraph when the document is empty.
 *
 * Uses ProseMirror decorations (not direct DOM mutation) so the changes are
 * invisible to the domObserver and cannot trigger an infinite flush loop.
 */
export const Placeholder = Extension.create({
  name: 'placeholder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            if (!isDocEmpty(state.doc)) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(0, state.doc.firstChild!.nodeSize, {
                'class': 'is-placeholder',
                'data-placeholder': PLACEHOLDER_TEXT,
              }),
            ]);
          },
        },
      }),
    ];
  },
});
