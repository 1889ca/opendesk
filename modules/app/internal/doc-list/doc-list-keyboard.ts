/** Contract: contracts/app/rules.md */

/**
 * Keyboard navigation for the document list.
 * Arrow Up/Down to move between rows, Enter to open, Delete/Backspace to delete.
 * Requires rows to have role="option" and tabindex="0", list to have role="listbox".
 */

import type { DocEntry } from './doc-row.ts';
import { TYPE_META } from './doc-row.ts';
import { confirmAndDelete } from './doc-operations.ts';
import { t } from '../i18n/index.ts';

/**
 * Set up keyboard navigation on a document list container.
 * Returns a cleanup function to remove the listener.
 */
export function setupKeyboardNav(
  listEl: HTMLElement,
  getDocById: (id: string) => DocEntry | undefined,
  onRefresh: () => void,
): () => void {
  listEl.setAttribute('role', 'listbox');
  listEl.setAttribute('aria-label', t('nav.dashboard'));

  function getRows(): HTMLElement[] {
    return Array.from(listEl.querySelectorAll<HTMLElement>('.doc-row-wrapper[data-doc-id]'));
  }

  function focusRow(row: HTMLElement): void {
    row.focus();
    row.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const rows = getRows();
    if (!rows.length) return;

    const active = document.activeElement as HTMLElement;
    const currentIdx = rows.indexOf(active);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIdx < rows.length - 1 ? currentIdx + 1 : 0;
        focusRow(rows[next]);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : rows.length - 1;
        focusRow(rows[prev]);
        break;
      }
      case 'Enter': {
        if (currentIdx < 0) break;
        e.preventDefault();
        const docId = rows[currentIdx].dataset.docId;
        if (!docId) break;
        const doc = getDocById(docId);
        if (!doc) break;
        const meta = TYPE_META[doc.document_type || 'text'] ?? TYPE_META.text;
        window.location.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (currentIdx < 0) break;
        // Only act if focus is on the row wrapper itself, not on an input inside it
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') break;
        e.preventDefault();
        const docId = rows[currentIdx].dataset.docId;
        if (!docId) break;
        const doc = getDocById(docId);
        if (!doc) break;
        const name = doc.title || t('editor.untitled');
        confirmAndDelete(docId, name, onRefresh);
        break;
      }
      case 'Home': {
        e.preventDefault();
        if (rows.length) focusRow(rows[0]);
        break;
      }
      case 'End': {
        e.preventDefault();
        if (rows.length) focusRow(rows[rows.length - 1]);
        break;
      }
    }
  }

  listEl.addEventListener('keydown', handleKeyDown);
  return () => listEl.removeEventListener('keydown', handleKeyDown);
}
