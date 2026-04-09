/** Contract: contracts/app/rules.md */

/**
 * Sort, filter, and pagination controls for the document list.
 * Extracted to keep doc-list.ts under the 200-line limit.
 */

import { t, type TranslationKey } from '../i18n/index.ts';

export type SortOption = 'updated_at-desc' | 'created_at-desc' | 'title-asc' | 'title-desc';
export type TypeFilter = 'all' | 'text' | 'spreadsheet' | 'presentation';

export interface DocListState {
  sort: SortOption;
  typeFilter: TypeFilter;
  page: number;
  totalPages: number;
  totalCount?: number;
}

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: SortOption; labelKey: TranslationKey }[] = [
  { value: 'updated_at-desc', labelKey: 'docList.sortUpdated' },
  { value: 'created_at-desc', labelKey: 'docList.sortCreated' },
  { value: 'title-asc', labelKey: 'docList.sortNameAZ' },
  { value: 'title-desc', labelKey: 'docList.sortNameZA' },
];

const TYPE_FILTERS: { value: TypeFilter; labelKey: TranslationKey }[] = [
  { value: 'all', labelKey: 'docList.filterAll' },
  { value: 'text', labelKey: 'docList.filterDocuments' },
  { value: 'spreadsheet', labelKey: 'docList.filterSpreadsheets' },
  { value: 'presentation', labelKey: 'docList.filterPresentations' },
];

export function parseSortOption(sort: SortOption): { sort: string; sortDir: string } {
  const [field, dir] = sort.split('-') as [string, string];
  return { sort: field, sortDir: dir };
}

export function buildApiUrl(
  baseUrl: string,
  state: Pick<DocListState, 'sort' | 'typeFilter' | 'page'>,
): string {
  const url = new URL(baseUrl, window.location.origin);
  const { sort, sortDir } = parseSortOption(state.sort);
  url.searchParams.set('sort', sort);
  url.searchParams.set('sortDir', sortDir);
  url.searchParams.set('page', String(state.page));
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (state.typeFilter !== 'all') url.searchParams.set('type', state.typeFilter);
  return url.pathname + url.search;
}

export function createControlsBar(
  state: DocListState,
  onChange: (next: Partial<DocListState>) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'doc-list-controls';

  // Document count
  if (state.totalCount !== undefined) {
    const countEl = document.createElement('span');
    countEl.className = 'doc-list-count';
    const filtered = state.typeFilter !== 'all';
    countEl.textContent = filtered
      ? t('docList.countFiltered', { n: String(state.totalCount) })
      : t('docList.count', { n: String(state.totalCount) });
    bar.appendChild(countEl);
  }

  // Type filter buttons
  const filterGroup = document.createElement('div');
  filterGroup.className = 'doc-list-filter-group';
  filterGroup.setAttribute('role', 'group');

  for (const opt of TYPE_FILTERS) {
    const btn = document.createElement('button');
    btn.className = 'doc-list-filter-btn';
    btn.textContent = t(opt.labelKey);
    btn.dataset.filter = opt.value;
    if (state.typeFilter === opt.value) btn.classList.add('active');
    btn.addEventListener('click', () => onChange({ typeFilter: opt.value, page: 1 }));
    filterGroup.appendChild(btn);
  }

  // Sort selector
  const sortLabel = document.createElement('label');
  sortLabel.className = 'doc-list-sort-label';
  sortLabel.textContent = t('docList.sortLabel');

  const sortSelect = document.createElement('select');
  sortSelect.className = 'doc-list-sort-select';

  for (const opt of SORT_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = t(opt.labelKey);
    if (state.sort === opt.value) option.selected = true;
    sortSelect.appendChild(option);
  }

  sortSelect.addEventListener('change', () => {
    onChange({ sort: sortSelect.value as SortOption, page: 1 });
  });

  sortLabel.appendChild(sortSelect);
  bar.appendChild(filterGroup);
  bar.appendChild(sortLabel);

  return bar;
}

export function createPaginationBar(
  state: DocListState,
  onChange: (next: Partial<DocListState>) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'doc-list-pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary doc-list-page-btn';
  prevBtn.textContent = t('docList.prevPage');
  prevBtn.disabled = state.page <= 1;
  prevBtn.addEventListener('click', () => onChange({ page: state.page - 1 }));

  const pageInfo = document.createElement('span');
  pageInfo.className = 'doc-list-page-info';
  pageInfo.textContent = t('docList.pageOf', {
    page: String(state.page),
    total: String(state.totalPages),
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-secondary doc-list-page-btn';
  nextBtn.textContent = t('docList.nextPage');
  nextBtn.disabled = state.page >= state.totalPages;
  nextBtn.addEventListener('click', () => onChange({ page: state.page + 1 }));

  bar.appendChild(prevBtn);
  bar.appendChild(pageInfo);
  bar.appendChild(nextBtn);

  return bar;
}
