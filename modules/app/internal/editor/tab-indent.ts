/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';

/**
 * TabIndent — keyboard shortcut extension for list indentation.
 * Tab sinks the current list item, Shift-Tab lifts it.
 */
export const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem('listItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('listItem'),
    };
  },
});
