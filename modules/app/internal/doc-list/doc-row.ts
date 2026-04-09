/** Contract: contracts/app/rules.md */

/**
 * Document row rendering for the doc list.
 * Supports multi-select checkboxes (issue #173), friendly empty state (issue #182),
 * and starred/favourites section (issue #184).
 */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { getCurrentFolderId } from './folder-list.ts';
import { showDeleteConfirmDialog } from './delete-confirm-dialog.ts';
import { getStarred, toggleStar } from './starred-store.ts';

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

const EMPTY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" class="empty-state-icon">'
  + '<rect x="10" y="8" width="38" height="48" rx="4" ry="4" fill="none" stroke="currentColor" stroke-width="3"/>'
  + '<line x1="18" y1="22" x2="40" y2="22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '<line x1="18" y1="30" x2="40" y2="30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '<line x1="18" y1="38" x2="32" y2="38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  + '</svg>';

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
  icon.textContent = meta.icon;
  const title = document.createElement('span');
  title.className = 'doc-row-title';
  title.textContent = docName;
  titleRow.append(icon, title);
  const time = document.createElement('span');
  time.className = 'doc-row-time';
  time.textContent = meta.label + ' \u00B7 ' + t('docList.updated', { time: formatRelativeTime(doc.updated_at) });
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
  deleteBtn.addEventListener('click', () => {
    showDeleteConfirmDialog(docName).then((confirmed) => {
      if (!confirmed) return;
      apiFetch('/api/documents/' + encodeURIComponent(doc.id), { method: 'DELETE' })
        .then(() => onDelete()).catch((err) => { console.error('Delete failed', err); });
    });
  });

  wrapper.append(checkLabel, row, starBtn, deleteBtn);
  return wrapper;
}

function renderEmptyState(listEl: HTMLElement, onNewDocument?: () => void): void {
  const emptyEl = document.createElement('div');
  emptyEl.className = 'doc-list-empty';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-state-icon-wrap';
  iconWrap.innerHTML = EMPTY_ICON_SVG;

  const key = getCurrentFolderId() ? 'folders.empty' : 'docList.noDocuments';
  const titleP = document.createElement('p');
  titleP.className = 'empty-title';
  titleP.textContent = t(key);

  const subtitleP = document.createElement('p');
  subtitleP.className = 'empty-subtitle';
  subtitleP.textContent = t('docList.noDocumentsSubtitle');

  emptyEl.append(iconWrap, titleP, subtitleP);

  if (onNewDocument && !getCurrentFolderId()) {
    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-primary empty-state-new-btn';
    newBtn.textContent = t('docList.newDocument');
    newBtn.addEventListener('click', () => onNewDocument());
    emptyEl.appendChild(newBtn);
  }

  listEl.appendChild(emptyEl);
}
