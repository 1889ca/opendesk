/** Contract: contracts/app/rules.md */

/**
 * Context menu for document rows and cards (issue #228).
 * Appended to document.body to avoid stacking-context issues.
 * Dismissed on click-outside or Escape key.
 */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { showNameDialog } from './name-dialog.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showToast } from '../shared/toast.ts';
import { toggleStar, getStarred } from './starred-store.ts';
import { TYPE_META, type DocEntry } from './doc-row.ts';

export interface ContextMenuCallbacks {
  onDelete: () => void;
  onStar: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onOpen: () => void;
}

let activeMenu: HTMLElement | null = null;

function dismissMenu(): void {
  activeMenu?.remove();
  activeMenu = null;
}

function buildMenuItem(label: string, onClick: () => void, modifier = ''): HTMLElement {
  const item = document.createElement('button');
  item.className = 'doc-context-item' + (modifier ? ' ' + modifier : '');
  item.type = 'button';
  item.textContent = label;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissMenu();
    onClick();
  });
  return item;
}

function buildSeparator(): HTMLElement {
  const sep = document.createElement('div');
  sep.className = 'doc-context-separator';
  return sep;
}

/**
 * Attach a context menu (right-click / long-press) to a wrapper element.
 * The menu is appended to document.body and dismissed on outside click or Escape.
 */
export function attachContextMenu(
  wrapper: HTMLElement,
  doc: DocEntry,
  callbacks: ContextMenuCallbacks,
): void {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function showAt(x: number, y: number): void {
    dismissMenu();

    const meta = TYPE_META[doc.document_type || 'text'] ?? TYPE_META.text;
    const isStarred = getStarred().has(doc.id);

    const menu = document.createElement('div');
    menu.className = 'doc-context-menu';
    menu.setAttribute('role', 'menu');

    menu.appendChild(buildMenuItem('Open', callbacks.onOpen));
    menu.appendChild(buildMenuItem('Open in new tab', () => {
      window.open(meta.editor + '?doc=' + encodeURIComponent(doc.id), '_blank', 'noopener');
    }));
    menu.appendChild(buildSeparator());
    menu.appendChild(buildMenuItem('Rename', callbacks.onRename));
    menu.appendChild(buildMenuItem('Duplicate', callbacks.onDuplicate));
    menu.appendChild(buildMenuItem(isStarred ? 'Unstar' : 'Star', callbacks.onStar));
    menu.appendChild(buildSeparator());
    menu.appendChild(buildMenuItem('Download DOCX', () => {
      const a = document.createElement('a');
      a.href = '/api/documents/' + encodeURIComponent(doc.id) + '/export?format=docx';
      a.download = (doc.title || 'document') + '.docx';
      a.click();
    }));
    menu.appendChild(buildMenuItem('Download ODT', () => {
      const a = document.createElement('a');
      a.href = '/api/documents/' + encodeURIComponent(doc.id) + '/export?format=odt';
      a.download = (doc.title || 'document') + '.odt';
      a.click();
    }));
    menu.appendChild(buildMenuItem('Download PDF', () => {
      const a = document.createElement('a');
      a.href = '/api/documents/' + encodeURIComponent(doc.id) + '/export?format=pdf';
      a.download = (doc.title || 'document') + '.pdf';
      a.click();
    }));
    menu.appendChild(buildSeparator());
    menu.appendChild(buildMenuItem('Delete', callbacks.onDelete, 'doc-context-item--danger'));

    document.body.appendChild(menu);
    activeMenu = menu;

    // Position — keep within viewport
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = x + rect.width > vw ? vw - rect.width - 8 : x;
    const top = y + rect.height > vh ? vh - rect.height - 8 : y;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }

  wrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showAt(e.clientX, e.clientY);
  });

  // Long-press for mobile
  wrapper.addEventListener('pointerdown', (e) => {
    longPressTimer = setTimeout(() => {
      showAt(e.clientX, e.clientY);
    }, 500);
  });

  wrapper.addEventListener('pointerup', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  wrapper.addEventListener('pointermove', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  // Dismiss on outside click or Escape (installed once, globally)
  if (!document.body.dataset.contextMenuListeners) {
    document.body.dataset.contextMenuListeners = '1';
    document.addEventListener('click', dismissMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dismissMenu();
    });
  }
}

/**
 * Build the standard callbacks for a document entry.
 * onRename patches /api/documents/:id, onDuplicate posts /api/documents/:id/duplicate.
 */
export function buildContextCallbacks(
  doc: DocEntry,
  onRefresh: () => void,
): ContextMenuCallbacks {
  const meta = TYPE_META[doc.document_type || 'text'] ?? TYPE_META.text;

  return {
    onOpen: () => {
      window.location.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);
    },

    onStar: () => {
      toggleStar(doc.id);
      onRefresh();
    },

    onRename: async () => {
      const newTitle = await showNameDialog('docList.titlePrompt', doc.title || '');
      if (!newTitle) return;
      try {
        await apiFetch('/api/documents/' + encodeURIComponent(doc.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        onRefresh();
      } catch (err) {
        console.error('Rename failed', err);
      }
    },

    onDuplicate: async () => {
      try {
        const res = await apiFetch('/api/documents/' + encodeURIComponent(doc.id) + '/duplicate', {
          method: 'POST',
        });
        if (res.ok) {
          onRefresh();
        } else {
          console.warn('Duplicate endpoint not available (status', res.status, ')');
        }
      } catch (err) {
        console.warn('Duplicate not available', err);
      }
    },

    onDelete: async () => {
      if (!await showDeleteConfirmDialog(doc.title || '')) return;
      try {
        await apiFetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' });
        showToast('Document deleted', 'success');
        onRefresh();
      } catch (err) { console.error('Delete failed', err); }
    },
  };
}
