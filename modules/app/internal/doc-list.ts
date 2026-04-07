/** Contract: contracts/app/rules.md */

import { createDocumentFromTemplate } from './template-picker.ts';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return seconds + ' seconds ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
}

function renderDocuments(listEl: HTMLElement, docs: DocEntry[]) {
  if (!docs.length) {
    listEl.innerHTML =
      '<div class="doc-list-empty">' +
        '<p class="empty-title">No documents yet</p>' +
        '<p class="empty-subtitle">Create your first document to get started.</p>' +
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
    title.textContent = doc.title || 'Untitled';

    const time = document.createElement('span');
    time.className = 'doc-row-time';
    time.textContent = 'Updated ' + timeAgo(doc.updated_at);

    info.appendChild(title);
    info.appendChild(time);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = doc.title || 'Untitled';
      if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
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
      listEl.innerHTML = '<div class="doc-list-empty"><p class="empty-title">Failed to load documents</p></div>';
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
