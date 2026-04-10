/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';
import { showNameDialog } from './name-dialog.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showToast } from '../shared/toast.ts';
import { toggleStar } from './starred-store.ts';
import { TYPE_META, type DocEntry } from './doc-row.ts';
import { showFolderPickerDialog } from './folder-picker-dialog.ts';
import type { ContextMenuCallbacks } from './doc-context-menu.ts';

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

    onMove: onRefresh,
  };
}
