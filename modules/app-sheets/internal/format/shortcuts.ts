/** Contract: contracts/app-sheets/rules.md */
import * as Y from 'yjs';
import { toggleBoolFormat } from './store.ts';

export type ShortcutCallbacks = {
  getActiveCell: () => { row: number; col: number };
  onFormatChanged: () => void;
};

/**
 * Attach formatting keyboard shortcuts to the document.
 * - Ctrl+B: toggle bold
 * - Ctrl+I: toggle italic
 * - Ctrl+U: toggle underline
 */
export function attachFormatShortcuts(
  ydoc: Y.Doc,
  callbacks: ShortcutCallbacks,
): () => void {
  function handler(e: KeyboardEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;

    let prop: 'bold' | 'italic' | 'underline' | undefined;
    if (e.key === 'b' || e.key === 'B') prop = 'bold';
    else if (e.key === 'i' || e.key === 'I') prop = 'italic';
    else if (e.key === 'u' || e.key === 'U') prop = 'underline';

    if (!prop) return;

    e.preventDefault();
    const { row, col } = callbacks.getActiveCell();
    toggleBoolFormat(ydoc, row, col, prop);
    callbacks.onFormatChanged();
  }

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
