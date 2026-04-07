/** Contract: contracts/app/rules.md */

import { createDocumentFromTemplate } from './template-picker.ts';
import { t } from './i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
}

function renderDocuments(listEl: HTMLElement, docs: DocEntry[]) {
  if (!docs.length) {
    listEl.innerHTML =
      '<div class="doc-list-empty">' +
        '<p class="empty-title">' + t('docList.noDocuments') + '</p>' +
        '<p class="empty-subtitle">' + t('docList.noDocumentsSubtitle') + '</p>' +
      '</div>';
    return;
  }

  listEl.innerHTML = '';
  for (const doc of docs) {
    const row = document.createElement('a');
    row.className = 'doc-row';
    row.href = '/editor.html?doc=' + encodeURIComponent(doc.id);

    const info = document.createElement('div');
    info.className = 'doc-row-info';

    const title = document.createElement('span');
    title.className = 'doc-row-title';
    title.textContent = doc.title || t('editor.untitled');

    const time = document.createElement('span');
    time.className = 'doc-row-time';
    time.textContent = t('docList.updated', { time: formatRelativeTime(doc.updated_at) });

    info.appendChild(title);
    info.appendChild(time);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = t('docList.delete');
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = doc.title || t('editor.untitled');
      if (!confirm(t('docList.deleteConfirm', { name }))) return;
      fetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' })
        .then(() => { loadDocuments(listEl); })
        .catch((err) => { console.error('Delete failed', err); });
    });

    row.appendChild(info);
    row.appendChild(deleteBtn);
    listEl.appendChild(row);
  }
}

function loadDocuments(listEl: HTMLElement) {
  fetch('/api/documents')
    .then((res) => res.json())
    .then((docs: DocEntry[]) => { renderDocuments(listEl, docs); })
    .catch((err) => {
      console.error('Failed to load documents', err);
      listEl.innerHTML = '<div class="doc-list-empty"><p class="empty-title">' + t('docList.loadFailed') + '</p></div>';
    });
}

function init() {
  const listEl = document.getElementById('doc-list');
  const newBtn = document.getElementById('new-doc-btn');
  if (!listEl || !newBtn) return;

  newBtn.addEventListener('click', async () => {
    try {
      const docId = await createDocumentFromTemplate();
      if (docId) {
        window.location.href = '/editor.html?doc=' + encodeURIComponent(docId);
      }
    } catch (err) {
      console.error('Create failed', err);
    }
  });

  loadDocuments(listEl);
}

document.addEventListener('DOMContentLoaded', init);
