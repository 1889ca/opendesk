/** Contract: contracts/app/shell.md */

/**
 * KB Browser view: unified interface for browsing, filtering, and managing
 * all Knowledge Base entries (references, entities, datasets, notes).
 */

import { fetchEntries, type KBEntryRecord } from '../kb-browser/kb-api.ts';
import { buildFilterBar, readFiltersFromURL, type KBFilterState } from '../kb-browser/filter-bar.ts';
import { renderEntryList, buildViewToggle, buildPagination, type ViewMode } from '../kb-browser/entry-list.ts';
import { buildDetailPanel, openDetail } from '../kb-browser/entry-detail.ts';
import { buildEntryForm, openCreateForm, openEditForm } from '../kb-browser/entry-form.ts';

let containerEl: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let paginationEl: HTMLElement | null = null;
let detailPanel: HTMLElement | null = null;
let formOverlay: HTMLElement | null = null;
let viewMode: ViewMode = 'grid';
let currentOffset = 0;
const PAGE_SIZE = 24;

let currentFilters: KBFilterState = {
  entryType: '',
  search: '',
  tags: '',
  sort: 'date-desc',
};

async function loadEntries(): Promise<void> {
  if (!listEl || !paginationEl) return;
  listEl.innerHTML = '<div class="kb-loading">Loading\u2026</div>';

  try {
    const entries = await fetchEntries({
      entryType: currentFilters.entryType || undefined,
      search: currentFilters.search || undefined,
      tags: currentFilters.tags || undefined,
      sort: currentFilters.sort,
      limit: PAGE_SIZE,
      offset: currentOffset,
    });

    renderEntryList(listEl, entries, viewMode, onEntrySelect);

    // Update pagination
    paginationEl.innerHTML = '';
    paginationEl.appendChild(buildPagination(currentOffset, PAGE_SIZE, entries.length, (newOffset) => {
      currentOffset = newOffset;
      loadEntries();
    }));
  } catch (err) {
    console.error('Failed to load KB entries', err);
    listEl.innerHTML = '<div class="kb-empty-state"><p>Failed to load entries</p></div>';
  }
}

function onEntrySelect(entry: KBEntryRecord): void {
  if (detailPanel) openDetail(detailPanel, entry);
}

function onFilterChange(state: KBFilterState): void {
  currentFilters = state;
  currentOffset = 0;
  loadEntries();
}

export async function mount(container: HTMLElement, _params: Record<string, string>): Promise<void> {
  containerEl = container;
  currentFilters = readFiltersFromURL();
  currentOffset = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'kb-browser';

  // Header
  const header = document.createElement('div');
  header.className = 'kb-browser__header';

  const titleEl = document.createElement('h1');
  titleEl.className = 'kb-browser__title';
  titleEl.textContent = 'Knowledge Base';

  const headerActions = document.createElement('div');
  headerActions.className = 'kb-browser__header-actions';

  const viewToggle = buildViewToggle(viewMode, (mode) => {
    viewMode = mode;
    if (listEl) {
      // Re-render the list in the current entries without a fetch
      loadEntries();
    }
  });

  const newBtn = document.createElement('button');
  newBtn.className = 'btn btn-primary';
  newBtn.textContent = 'New Entry';
  newBtn.addEventListener('click', () => {
    if (formOverlay) openCreateForm(formOverlay);
  });

  headerActions.appendChild(viewToggle);
  headerActions.appendChild(newBtn);
  header.appendChild(titleEl);
  header.appendChild(headerActions);

  // Filter bar
  const filterBar = buildFilterBar(onFilterChange);

  // Main content area with detail panel
  const contentArea = document.createElement('div');
  contentArea.className = 'kb-browser__content';

  listEl = document.createElement('div');
  listEl.className = 'kb-entry-grid';

  paginationEl = document.createElement('div');
  paginationEl.className = 'kb-browser__pagination';

  const listWrapper = document.createElement('div');
  listWrapper.className = 'kb-browser__list-area';
  listWrapper.appendChild(listEl);
  listWrapper.appendChild(paginationEl);

  detailPanel = buildDetailPanel(
    () => {}, // onClose
    (entry) => { if (formOverlay) openEditForm(formOverlay, entry); },
    () => loadEntries(),
  );

  contentArea.appendChild(listWrapper);
  contentArea.appendChild(detailPanel);

  // Entry form overlay
  formOverlay = buildEntryForm(() => loadEntries());

  wrapper.appendChild(header);
  wrapper.appendChild(filterBar);
  wrapper.appendChild(contentArea);
  wrapper.appendChild(formOverlay);
  container.appendChild(wrapper);

  await loadEntries();
}

export function unmount(): void {
  containerEl = null;
  listEl = null;
  paginationEl = null;
  detailPanel = null;
  formOverlay = null;
}
