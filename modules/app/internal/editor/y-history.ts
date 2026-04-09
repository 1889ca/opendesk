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
import { yUndoPlugin, undo, redo } from '@tiptap/y-tiptap';

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

  addProseMirrorPlugins() {
    return [yUndoPlugin()];
  },

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
