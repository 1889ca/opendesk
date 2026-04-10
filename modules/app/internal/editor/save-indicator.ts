/** Contract: contracts/app/rules.md */
/**
 * Save indicator — shows "Saving…" / "Saved" next to the document title.
 * Fires on any document transaction; uses an optimistic delay to confirm
 * saved state (Hocuspocus auto-syncs in the background).
 */
import type { Editor } from '@tiptap/core';

const SAVED_DELAY_MS = 1800;

export function buildSaveIndicator(editor: Editor): HTMLElement {
  const el = document.createElement('span');
  el.className = 'save-indicator';
  el.setAttribute('aria-live', 'polite');

  let timer: ReturnType<typeof setTimeout> | null = null;

  function setSaving(): void {
    if (timer) clearTimeout(timer);
    el.textContent = 'Saving\u2026';
    el.dataset.state = 'saving';
    timer = setTimeout(setSaved, SAVED_DELAY_MS);
  }

  function setSaved(): void {
    el.textContent = 'Saved';
    el.dataset.state = 'saved';
  }

  editor.on('transaction', ({ transaction }) => {
    if (transaction.docChanged) setSaving();
  });

  return el;
}
