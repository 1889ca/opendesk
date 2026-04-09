/** Contract: contracts/app/rules.md */

/**
 * Document row rendering for the doc list.
 * Supports multi-select checkboxes (issue #173), friendly empty state (issue #182),
 * starred/favourites section (issue #184), context menu (issue #228),
 * and hover preview (issue #231).
 */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { showNameDialog } from './name-dialog.ts';
import { getStarred, toggleStar } from './starred-store.ts';
import { showToast } from '../shared/toast.ts';
import { attachContextMenu } from './doc-context-menu.ts';
import { attachHoverPreview } from './doc-hover-preview.ts';
import { renderEmptyState } from './doc-empty-state.ts';

export interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
  document_type?: string;
}

// Inline SVG icons — color-coded per type (matches Google Docs visual language)
const DOC_ICON = '<svg viewBox="0 0 20 24" aria-hidden="true" class="doc-type-icon"><rect x="1.5" y="0.5" width="13" height="17" rx="1.5" fill="#4285F4" fill-opacity="0.12" stroke="#4285F4" stroke-width="1.25"/><path d="M13.5 0.5 L13.5 4.5 L17.5 4.5" stroke="#4285F4" stroke-width="1.25" fill="none" stroke-linejoin="round"/><line x1="4" y1="7" x2="12" y2="7" stroke="#4285F4" stroke-width="1.25" stroke-linecap="round"/><line x1="4" y1="10" x2="12" y2="10" stroke="#4285F4" stroke-width="1.25" stroke-linecap="round"/><line x1="4" y1="13" x2="9" y2="13" stroke="#4285F4" stroke-width="1.25" stroke-linecap="round"/></svg>';
const SHEET_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" class="doc-type-icon"><rect x="1" y="1" width="18" height="18" rx="2" fill="#0F9D58" fill-opacity="0.12" stroke="#0F9D58" stroke-width="1.25"/><line x1="1" y1="7" x2="19" y2="7" stroke="#0F9D58" stroke-width="1" opacity="0.5"/><line x1="1" y1="13" x2="19" y2="13" stroke="#0F9D58" stroke-width="1" opacity="0.5"/><line x1="7" y1="1" x2="7" y2="19" stroke="#0F9D58" stroke-width="1" opacity="0.5"/><line x1="13" y1="1" x2="13" y2="19" stroke="#0F9D58" stroke-width="1" opacity="0.5"/></svg>';
const SLIDES_ICON = '<svg viewBox="0 0 24 18" aria-hidden="true" class="doc-type-icon"><rect x="1" y="1" width="22" height="14" rx="2" fill="#F4B400" fill-opacity="0.15" stroke="#F4B400" stroke-width="1.25"/><rect x="4" y="4" width="14" height="8" rx="1" fill="#F4B400" fill-opacity="0.25"/><line x1="12" y1="15" x2="12" y2="18" stroke="#F4B400" stroke-width="1.25"/><line x1="8" y1="17.5" x2="16" y2="17.5" stroke="#F4B400" stroke-width="1.25" stroke-linecap="round"/></svg>';

export const TYPE_META: Record<string, { icon: string; label: string; editor: string }> = {
  text:         { icon: DOC_ICON,    label: 'Document',     editor: '/editor.html' },
  spreadsheet:  { icon: SHEET_ICON,  label: 'Spreadsheet',  editor: '/spreadsheet.html' },
  presentation: { icon: SLIDES_ICON, label: 'Presentation', editor: '/presentation.html' },
};

export interface RenderDocumentsOptions {
  listEl: HTMLElement;
  docs: DocEntry[];
  onDelete: () => void;
  onNewDocument?: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function renderDocuments(options: RenderDocumentsOptions): void {
  const { listEl, docs, onDelete, onNewDocument, selectedIds, onSelectionChange } = options;

  if (!docs.length) {
    renderEmptyState(listEl, onNewDocument);
    return;
  }

  function rerender(): void {
    listEl.innerHTML = '';
    renderDocuments({ ...options, selectedIds, onSelectionChange });
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
    for (const doc of starredDocs) {
      section.appendChild(buildDocRow(doc, onDelete, rerender, selectedIds, onSelectionChange));
    }
    listEl.appendChild(section);
  }

  for (const doc of restDocs) {
    listEl.appendChild(buildDocRow(doc, onDelete, rerender, selectedIds, onSelectionChange));
  }
}

function buildDocRow(
  doc: DocEntry,
  onDelete: () => void,
  onStarToggle: () => void,
  selectedIds: Set<string>,
  onSelectionChange: (ids: Set<string>) => void,
): HTMLElement {
  const meta = TYPE_META[doc.document_type || 'text'] || TYPE_META.text;
  const isStarred = getStarred().has(doc.id);
  const docName = doc.title || t('editor.untitled');

  const wrapper = document.createElement('div');
  wrapper.className = 'doc-row-wrapper';
  wrapper.dataset.type = doc.document_type || 'text';

  const checkLabel = document.createElement('label');
  checkLabel.className = 'doc-row-check-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'doc-row-checkbox';
  checkbox.setAttribute('aria-label', 'Select ' + docName);
  checkbox.checked = selectedIds.has(doc.id);
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (checkbox.checked) { next.add(doc.id); } else { next.delete(doc.id); }
    onSelectionChange(next);
  });
  checkLabel.appendChild(checkbox);

  const row = document.createElement('a');
  row.className = 'doc-row';
  row.href = meta.editor + '?doc=' + encodeURIComponent(doc.id);
  row.addEventListener('click', (e) => {
    if (selectedIds.size > 0) {
      e.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change'));
    }
  });

  const info = document.createElement('div');
  info.className = 'doc-row-info';
  const titleRow = document.createElement('div');
  titleRow.className = 'doc-row-title-row';
  const icon = document.createElement('span');
  icon.className = 'doc-row-icon';
  icon.innerHTML = meta.icon;
  const title = document.createElement('span');
  title.className = 'doc-row-title';
  title.textContent = docName;
  titleRow.append(icon, title);
  const time = document.createElement('span');
  time.className = 'doc-row-time';
  time.textContent = meta.label + ' \u00B7 ' + t('docList.updated', { time: formatRelativeTime(doc.updated_at) });
  time.title = new Date(doc.updated_at).toLocaleString();
  info.append(titleRow, time);
  row.appendChild(info);

  const starBtn = document.createElement('button');
  starBtn.className = 'btn btn-star' + (isStarred ? ' btn-star--active' : '');
  starBtn.textContent = isStarred ? '\u2605' : '\u2606';
  starBtn.setAttribute('aria-label', isStarred ? 'Unstar document' : 'Star document');
  starBtn.addEventListener('click', () => { toggleStar(doc.id); onStarToggle(); });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete';
  deleteBtn.textContent = t('docList.delete');
  deleteBtn.setAttribute('aria-label', t('docList.deleteAriaLabel', { name: docName }));
  deleteBtn.addEventListener('click', () => confirmAndDelete(doc.id, docName, onDelete));

  wrapper.append(checkLabel, row, starBtn, deleteBtn);

  attachContextMenu(wrapper, doc, {
    onOpen: () => { window.location.href = meta.editor + '?doc=' + encodeURIComponent(doc.id); },
    onStar: () => { toggleStar(doc.id); onStarToggle(); },
    onRename: () => renameDoc(doc, onDelete),
    onDuplicate: () => duplicateDoc(doc.id, onDelete),
    onDelete: () => confirmAndDelete(doc.id, docName, onDelete),
  });

  attachHoverPreview(wrapper, doc.id);

  return wrapper;
}

async function confirmAndDelete(id: string, name: string, onDelete: () => void): Promise<void> {
  if (!await showDeleteConfirmDialog(name)) return;
  try {
    await apiFetch('/api/documents/' + encodeURIComponent(id), { method: 'DELETE' });
    showToast('Document deleted', 'success');
    onDelete();
  } catch (err) { console.error('Delete failed', err); }
}

async function renameDoc(doc: DocEntry, onRefresh: () => void): Promise<void> {
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
}

async function duplicateDoc(id: string, onRefresh: () => void): Promise<void> {
  try {
    const res = await apiFetch('/api/documents/' + encodeURIComponent(id) + '/duplicate', { method: 'POST' });
    if (res.ok) { onRefresh(); } else { console.warn('Duplicate not available (status', res.status, ')'); }
  } catch (err) {
    console.warn('Duplicate not available', err);
  }
}
