/** Contract: contracts/app/rules.md */

/**
 * Document row rendering for the doc list.
 * Extracted to keep doc-list.ts under the 200-line limit.
 */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { getCurrentFolderId } from './folder-list.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';

export interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
  document_type?: string;
}

export const TYPE_META: Record<string, { icon: string; label: string; editor: string }> = {
  text:         { icon: '\u{1F4C4}', label: 'Document',     editor: '/editor.html' },
  spreadsheet:  { icon: '\u{1F4CA}', label: 'Spreadsheet',  editor: '/spreadsheet.html' },
  presentation: { icon: '\u{1F3AC}', label: 'Presentation', editor: '/presentation.html' },
};

export function renderDocuments(
  listEl: HTMLElement,
  docs: DocEntry[],
  onDelete: () => void,
): void {
  if (!docs.length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'doc-list-empty';
    const key = getCurrentFolderId() ? 'folders.empty' : 'docList.noDocuments';
    const titleP = document.createElement('p');
    titleP.className = 'empty-title';
    titleP.textContent = t(key);
    const subtitleP = document.createElement('p');
    subtitleP.className = 'empty-subtitle';
    subtitleP.textContent = t('docList.noDocumentsSubtitle');
    emptyEl.append(titleP, subtitleP);
    listEl.appendChild(emptyEl);
    return;
  }

  for (const doc of docs) {
    const meta = TYPE_META[doc.document_type || 'text'] || TYPE_META.text;

    // Wrapper holds the link + delete button as siblings so the delete button
    // is never a descendant of the <a>, preventing the nested-interactive bug
    // (issues #156, #177).
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-row-wrapper';

    const row = document.createElement('a');
    row.className = 'doc-row';
    row.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);

    const info = document.createElement('div');
    info.className = 'doc-row-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'doc-row-title-row';

    const icon = document.createElement('span');
    icon.className = 'doc-row-icon';
    icon.textContent = meta.icon;

    const title = document.createElement('span');
    title.className = 'doc-row-title';
    title.textContent = doc.title || t('editor.untitled');

    titleRow.appendChild(icon);
    titleRow.appendChild(title);

    const time = document.createElement('span');
    time.className = 'doc-row-time';
    time.textContent = meta.label + ' \u00B7 ' + t('docList.updated', { time: formatRelativeTime(doc.updated_at) });

    info.appendChild(titleRow);
    info.appendChild(time);
    row.appendChild(info);

    const docName = doc.title || t('editor.untitled');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = t('docList.delete');
    deleteBtn.setAttribute('aria-label', t('docList.deleteAriaLabel', { name: docName }));
    deleteBtn.addEventListener('click', () => {
      showDeleteConfirmDialog(docName).then((confirmed) => {
        if (!confirmed) return;
        apiFetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' })
          .then(() => onDelete())
          .catch((err) => { console.error('Delete failed', err); });
      });
    });

    wrapper.appendChild(row);
    wrapper.appendChild(deleteBtn);
    listEl.appendChild(wrapper);
  }
}
