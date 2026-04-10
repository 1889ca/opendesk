/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const PLACEHOLDER_TEXT = "Start typing, or press '/' for commands\u2026";
const pluginKey = new PluginKey('placeholder');

/**
 * Placeholder — shows a hint on the first paragraph when the document is empty.
 * Sets `data-placeholder` and `is-editor-empty` class; CSS renders the hint.
 */
export const Placeholder = Extension.create({
  name: 'placeholder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        view() {
          return {
            update(view) {
              const { doc } = view.state;
              const isEmpty =
                doc.childCount === 1 &&
                doc.firstChild !== null &&
                doc.firstChild.isTextblock &&
                doc.firstChild.content.size === 0;

              const proseMirrorEl = view.dom as HTMLElement;

              if (isEmpty) {
                proseMirrorEl.classList.add('is-editor-empty');
                const firstChild = proseMirrorEl.firstElementChild as HTMLElement | null;
                if (firstChild) {
                  firstChild.setAttribute('data-placeholder', PLACEHOLDER_TEXT);
                }
              } else {
                proseMirrorEl.classList.remove('is-editor-empty');
                const firstChild = proseMirrorEl.firstElementChild as HTMLElement | null;
                if (firstChild) {
                  firstChild.removeAttribute('data-placeholder');
                }
              }
            },
          };
        },
      }),
    ];
  },
});
