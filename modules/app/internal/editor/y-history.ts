/** Contract: contracts/app/rules.md */
/**
 * YHistory — TipTap extension that wires yUndoPlugin (y-tiptap) for
 * collaborative-aware undo/redo. Each user's undo stack is tracked
 * independently, so you only undo your own changes.
 *
 * Replaces the default ProseMirror history plugin which is incompatible
 * with Yjs (StarterKit must be configured with `undoRedo: false`).
 */
import { Extension } from '@tiptap/core';
import { undo, redo } from '@tiptap/y-tiptap';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    yHistory: {
      undo: () => ReturnType;
      redo: () => ReturnType;
    };
  }
}

export const YHistory = Extension.create({
  name: 'yHistory',

  // NOTE: do NOT call yUndoPlugin() here.
  // @tiptap/extension-collaboration already registers the y-undo$ plugin.
  // Adding it again causes: "Adding different instances of a keyed plugin (y-undo$)"
  // The undo/redo commands below work with the plugin Collaboration registered.

  addCommands() {
    return {
      undo:
        () =>
        ({ state }) =>
          undo(state),
      redo:
        () =>
        ({ state }) =>
          redo(state),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Mod-Shift-z': () => this.editor.commands.redo(),
    };
  },
});
