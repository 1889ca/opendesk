/** Contract: contracts/app-kb/rules.md */

import type { KBEntryRecord } from './kb-api.ts';
import { createEntryCard } from './entry-card.ts';
import { partitionPinned, createPinnedHeader, createUnpinnedHeader } from './pinned-section.ts';

export type ViewMode = 'grid' | 'list';

/** Render a list/grid of KB entries into a container. */
export function renderEntryList(
  container: HTMLElement,
  entries: KBEntryRecord[],
  viewMode: ViewMode,
  onSelect: (entry: KBEntryRecord) => void,
  entryType = '',
): void {
  container.innerHTML = '';
  container.className = 'kb-entry-container';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'kb-empty-state';
    empty.innerHTML = '<p>No entries found</p><p class="kb-empty-hint">Try adjusting your filters or create a new entry.</p>';
    container.appendChild(empty);
    return;
  }

  const { pinned, unpinned } = partitionPinned(entries, entryType);
  const gridClass = viewMode === 'grid' ? 'kb-entry-grid' : 'kb-entry-list';

  if (pinned.length > 0) {
    container.appendChild(createPinnedHeader());
    const pinnedGrid = document.createElement('div');
    pinnedGrid.className = gridClass;
    for (const entry of pinned) pinnedGrid.appendChild(createEntryCard(entry, onSelect));
    container.appendChild(pinnedGrid);

    container.appendChild(createUnpinnedHeader());
  }

  const mainGrid = document.createElement('div');
  mainGrid.className = gridClass;
  for (const entry of unpinned) mainGrid.appendChild(createEntryCard(entry, onSelect));
  container.appendChild(mainGrid);
}

/** Build the view mode toggle (grid/list). */
export function buildViewToggle(
  initialMode: ViewMode,
  onChange: (mode: ViewMode) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'kb-view-toggle';

  const gridBtn = document.createElement('button');
  gridBtn.className = 'kb-view-toggle__btn';
  gridBtn.setAttribute('aria-label', 'Grid view');
  gridBtn.textContent = '\u25A6';
  gridBtn.title = 'Grid view';

  const listBtn = document.createElement('button');
  listBtn.className = 'kb-view-toggle__btn';
  listBtn.setAttribute('aria-label', 'List view');
  listBtn.textContent = '\u2630';
  listBtn.title = 'List view';

  function setActive(mode: ViewMode): void {
    gridBtn.classList.toggle('active', mode === 'grid');
    listBtn.classList.toggle('active', mode === 'list');
  }

  setActive(initialMode);

  gridBtn.addEventListener('click', () => { setActive('grid'); onChange('grid'); });
  listBtn.addEventListener('click', () => { setActive('list'); onChange('list'); });

  wrapper.appendChild(gridBtn);
  wrapper.appendChild(listBtn);
  return wrapper;
}

/** Build a simple pagination bar. */
export function buildPagination(
  offset: number,
  limit: number,
  count: number,
  onPage: (newOffset: number) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'kb-pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary btn-sm';
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = offset === 0;
  prevBtn.addEventListener('click', () => onPage(Math.max(0, offset - limit)));

  const info = document.createElement('span');
  info.className = 'kb-pagination__info';
  const start = count > 0 ? offset + 1 : 0;
  const end = offset + count;
  info.textContent = `${start}\u2013${end}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary btn-sm';
  nextBtn.textContent = 'Next';
  nextBtn.disabled = count < limit;
  nextBtn.addEventListener('click', () => onPage(offset + limit));

  bar.appendChild(prevBtn);
  bar.appendChild(info);
  bar.appendChild(nextBtn);
  return bar;
}
