/** Contract: contracts/app/rules.md */

/**
 * Grid card rendering for the document list (issue #208).
 * Cards display icon, title, last-modified timestamp, and type colour accent.
 * Context menu (issue #228) and hover preview (issue #231) are wired here.
 */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showNameDialog } from './name-dialog.ts';
import { getStarred, toggleStar } from './starred-store.ts';
import { showToast } from '../shared/toast.ts';
import { TYPE_META, type DocEntry } from './doc-row.ts';
import { attachContextMenu } from './doc-context-menu.ts';
import { attachHoverPreview } from './doc-hover-preview.ts';

export interface RenderDocumentsGridOptions {
  listEl: HTMLElement;
  docs: DocEntry[];
  onDelete: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function renderDocumentsGrid(options: RenderDocumentsGridOptions): void {
  const { listEl, docs, onDelete, selectedIds, onSelectionChange } = options;

  function rerender(): void {
    listEl.innerHTML = '';
    renderDocumentsGrid({ ...options, selectedIds, onSelectionChange });
  }

  const starred = getStarred();
  const starredDocs = docs.filter((d) => starred.has(d.id));
  const restDocs = docs.filter((d) => !starred.has(d.id));

  if (starredDocs.length > 0) {
    const section = document.createElement('div');
    section.className = 'doc-list-section';
    const heading = document.createElement('h2');
    heading.className = 'doc-list-section-heading';
    heading.textContent = 'Starred';
    section.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'doc-grid';
    for (const doc of starredDocs) {
      grid.appendChild(buildDocCard(doc, onDelete, rerender, selectedIds, onSelectionChange));
    }
    section.appendChild(grid);
    listEl.appendChild(section);
  }

  if (restDocs.length > 0) {
    const grid = document.createElement('div');
    grid.className = 'doc-grid';
    for (const doc of restDocs) {
      grid.appendChild(buildDocCard(doc, onDelete, rerender, selectedIds, onSelectionChange));
    }
    listEl.appendChild(grid);
  }
}

function buildDocCard(
  doc: DocEntry,
  onDelete: () => void,
  onStarToggle: () => void,
  selectedIds: Set<string>,
  onSelectionChange: (ids: Set<string>) => void,
): HTMLElement {
  const meta = TYPE_META[doc.document_type || 'text'] ?? TYPE_META.text;
  const isStarred = getStarred().has(doc.id);
  const docName = doc.title || t('editor.untitled');
  const docType = doc.document_type || 'text';

  const card = document.createElement('div');
  card.className = 'doc-card';
  card.dataset.type = docType;
  if (selectedIds.has(doc.id)) card.classList.add('doc-card--selected');

  const header = document.createElement('div');
  header.className = 'doc-card-header';

  const icon = document.createElement('span');
  icon.className = 'doc-card-icon';
  icon.innerHTML = meta.icon;

  const title = document.createElement('span');
  title.className = 'doc-card-title';
  title.textContent = docName;
  title.title = docName;

  header.append(icon, title);

  const footer = document.createElement('div');
  footer.className = 'doc-card-footer';
  const time = document.createElement('span');
  time.className = 'doc-card-time';
  time.textContent = t('docList.updated', { time: formatRelativeTime(doc.updated_at) });
  time.title = new Date(doc.updated_at).toLocaleString();
  footer.appendChild(time);

  const link = document.createElement('a');
  link.className = 'doc-card-link';
  link.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);
  link.setAttribute('aria-label', docName);
  link.addEventListener('click', (e) => {
    if (selectedIds.size > 0) {
      e.preventDefault();
      const next = new Set(selectedIds);
      if (next.has(doc.id)) { next.delete(doc.id); } else { next.add(doc.id); }
      onSelectionChange(next);
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'doc-card-overlay';

  const starBtn = document.createElement('button');
  starBtn.className = 'btn btn-star' + (isStarred ? ' btn-star--active' : '');
  starBtn.textContent = isStarred ? '\u2605' : '\u2606';
  starBtn.setAttribute('aria-label', isStarred ? 'Unstar document' : 'Star document');
  starBtn.addEventListener('click', (e) => { e.preventDefault(); toggleStar(doc.id); onStarToggle(); });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete';
  deleteBtn.textContent = t('docList.delete');
  deleteBtn.setAttribute('aria-label', t('docList.deleteAriaLabel', { name: docName }));
  deleteBtn.addEventListener('click', (e) => { e.preventDefault(); cardConfirmDelete(doc.id, docName, onDelete); });

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'doc-card-checkbox';
  checkbox.setAttribute('aria-label', 'Select ' + docName);
  checkbox.checked = selectedIds.has(doc.id);
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (checkbox.checked) { next.add(doc.id); } else { next.delete(doc.id); }
    onSelectionChange(next);
  });

  overlay.append(checkbox, starBtn, deleteBtn);
  card.append(link, header, footer, overlay);

  attachContextMenu(card, doc, {
    onOpen: () => { window.location.href = meta.editor + '?doc=' + encodeURIComponent(doc.id); },
    onStar: () => { toggleStar(doc.id); onStarToggle(); },
    onRename: () => cardRename(doc, onDelete),
    onDuplicate: () => cardDuplicate(doc.id, onDelete),
    onDelete: () => cardConfirmDelete(doc.id, docName, onDelete),
  });

  attachHoverPreview(card, doc.id);

  return card;
}

async function cardConfirmDelete(id: string, name: string, onDelete: () => void): Promise<void> {
  if (!await showDeleteConfirmDialog(name)) return;
  try {
    await apiFetch('/api/documents/' + encodeURIComponent(id), { method: 'DELETE' });
    showToast('Document deleted', 'success');
    onDelete();
  } catch (err) { console.error('Delete failed', err); }
}

async function cardRename(doc: DocEntry, onRefresh: () => void): Promise<void> {
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

async function cardDuplicate(id: string, onRefresh: () => void): Promise<void> {
  try {
    const res = await apiFetch('/api/documents/' + encodeURIComponent(id) + '/duplicate', { method: 'POST' });
    if (res.ok) { onRefresh(); } else { console.warn('Duplicate not available (status', res.status, ')'); }
  } catch (err) { console.warn('Duplicate not available', err); }
}
