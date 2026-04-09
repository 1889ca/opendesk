/** Contract: contracts/app/rules.md */

/**
 * Shared document mutation operations used by both list rows and grid cards.
 * Extracted to avoid duplication between doc-row.ts and doc-card.ts (issue #300).
 */

import { apiFetch } from '../shared/api-client.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showNameDialog } from './name-dialog.ts';
import { showToast } from '../shared/toast.ts';
import type { DocEntry } from './doc-row.ts';

export async function confirmAndDelete(id: string, name: string, onRefresh: () => void): Promise<void> {
  if (!await showDeleteConfirmDialog(name)) return;
  try {
    await apiFetch('/api/documents/' + encodeURIComponent(id), { method: 'DELETE' });
    showToast('Document deleted', 'success');
    onRefresh();
  } catch (err) { console.error('Delete failed', err); }
}

export async function renameDoc(doc: DocEntry, onRefresh: () => void): Promise<void> {
  const newTitle = await showNameDialog('docList.titlePrompt', doc.title || '');
  if (!newTitle) return;
  try {
    await apiFetch('/api/documents/' + encodeURIComponent(doc.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    onRefresh();
  } catch (err) { console.error('Rename failed', err); }
}

export async function duplicateDoc(id: string, onRefresh: () => void): Promise<void> {
  try {
    const res = await apiFetch('/api/documents/' + encodeURIComponent(id) + '/duplicate', { method: 'POST' });
    if (res.ok) { onRefresh(); } else { console.warn('Duplicate not available (status', res.status, ')'); }
  } catch (err) { console.warn('Duplicate not available', err); }
}
