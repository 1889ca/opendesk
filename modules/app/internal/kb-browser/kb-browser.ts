/** Contract: contracts/app/rules.md */

import {
  fetchEntries,
  fetchEntry,
  createEntry,
  type KbEntryData,
} from './kb-api.ts';
import type { KbEntryStatus } from '../../../kb/contract.ts';
import { createStatusBadge } from './status-badge.ts';
import { renderDetailPanel } from './detail-panel.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { initTheme } from '../shared/theme-toggle.ts';

let activeFilter: KbEntryStatus | undefined;
let selectedEntryId: string | null = null;

function renderEntryRow(entry: KbEntryData, onClick: (id: string) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'kb-entry-row';
  if (entry.id === selectedEntryId) row.classList.add('kb-entry-active');
  row.addEventListener('click', () => onClick(entry.id));

  const info = document.createElement('div');
  info.className = 'kb-entry-info';

  const titleRow = document.createElement('div');
  titleRow.className = 'kb-entry-title-row';

  const title = document.createElement('span');
  title.className = 'kb-entry-title';
  title.textContent = entry.title;

  const badge = createStatusBadge(entry.status);
  const versionTag = document.createElement('span');
  versionTag.className = 'kb-entry-version-tag';
  versionTag.textContent = `v${entry.version}`;

  titleRow.append(title, badge, versionTag);

  const meta = document.createElement('span');
  meta.className = 'kb-entry-meta';
  meta.textContent = `Updated ${formatRelativeTime(entry.updated_at)}`;

  info.append(titleRow, meta);
  row.appendChild(info);
  return row;
}

function renderFilterBar(container: HTMLElement, onFilter: (status?: KbEntryStatus) => void): void {
  const bar = document.createElement('div');
  bar.className = 'kb-filter-bar';

  const filters: Array<{ label: string; value: KbEntryStatus | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Draft', value: 'draft' },
    { label: 'Reviewed', value: 'reviewed' },
    { label: 'Published', value: 'published' },
    { label: 'Deprecated', value: 'deprecated' },
  ];

  for (const f of filters) {
    const btn = document.createElement('button');
    btn.className = 'kb-filter-btn';
    if (activeFilter === f.value) btn.classList.add('kb-filter-active');
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      activeFilter = f.value;
      onFilter(f.value);
    });
    bar.appendChild(btn);
  }

  container.appendChild(bar);
}

async function loadEntryList(
  listEl: HTMLElement,
  detailEl: HTMLElement,
  status?: KbEntryStatus,
): Promise<void> {
  listEl.innerHTML = '';
  renderFilterBar(listEl, (s) => loadEntryList(listEl, detailEl, s));

  try {
    const entries = await fetchEntries(status);
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kb-list-empty';
      empty.textContent = status
        ? `No ${status} entries.`
        : 'No knowledge base entries yet.';
      listEl.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      listEl.appendChild(renderEntryRow(entry, (id) => selectEntry(id, listEl, detailEl)));
    }
  } catch (err) {
    console.error('Failed to load KB entries', err);
    const errEl = document.createElement('div');
    errEl.className = 'kb-list-empty';
    errEl.textContent = 'Failed to load entries.';
    listEl.appendChild(errEl);
  }
}

async function selectEntry(
  id: string,
  listEl: HTMLElement,
  detailEl: HTMLElement,
): Promise<void> {
  selectedEntryId = id;
  try {
    const entry = await fetchEntry(id);
    renderDetailPanel(detailEl, entry, {
      onUpdate: () => {
        loadEntryList(listEl, detailEl, activeFilter);
        selectEntry(id, listEl, detailEl);
      },
      onClose: () => {
        selectedEntryId = null;
        detailEl.innerHTML = '';
        detailEl.className = '';
        loadEntryList(listEl, detailEl, activeFilter);
      },
    });
  } catch (err) {
    console.error('Failed to load entry', err);
  }
}

function init(): void {
  initTheme();

  const listEl = document.getElementById('kb-list');
  const detailEl = document.getElementById('kb-detail');
  const newBtn = document.getElementById('new-kb-btn');
  if (!listEl || !detailEl) return;

  newBtn?.addEventListener('click', async () => {
    const title = prompt('Entry title:');
    if (!title) return;
    try {
      const entry = await createEntry(title, '');
      await loadEntryList(listEl, detailEl, activeFilter);
      await selectEntry(entry.id, listEl, detailEl);
    } catch (err) {
      console.error('Create failed', err);
    }
  });

  loadEntryList(listEl, detailEl, activeFilter);
}

document.addEventListener('DOMContentLoaded', init);
