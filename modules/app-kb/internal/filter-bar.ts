/** Contract: contracts/app-kb/rules.md */

/** Active filter state for the KB browser. */
export interface KBFilterState {
  entryType: string;
  search: string;
  tags: string;
  sort: string;
}

const ENTRY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'reference', label: 'References' },
  { value: 'entity', label: 'Entities' },
  { value: 'dataset', label: 'Datasets' },
  { value: 'note', label: 'Notes' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'title-asc', label: 'Title A\u2013Z' },
  { value: 'title-desc', label: 'Title Z\u2013A' },
];

type FilterChangeCallback = (state: KBFilterState) => void;

/** Read current filter state from URL query params. */
export function readFiltersFromURL(): KBFilterState {
  const params = new URLSearchParams(window.location.search);
  return {
    entryType: params.get('entryType') ?? '',
    search: params.get('search') ?? '',
    tags: params.get('tags') ?? '',
    sort: params.get('sort') ?? 'date-desc',
  };
}

/** Write filter state to URL query params without navigation. */
export function writeFiltersToURL(state: KBFilterState): void {
  const params = new URLSearchParams();
  if (state.entryType) params.set('entryType', state.entryType);
  if (state.search) params.set('search', state.search);
  if (state.tags) params.set('tags', state.tags);
  if (state.sort && state.sort !== 'date-desc') params.set('sort', state.sort);
  const qs = params.toString();
  const url = qs ? `/kb?${qs}` : '/kb';
  history.replaceState(null, '', url);
}

/** Build the filter bar DOM and wire up event handlers. */
export function buildFilterBar(onChange: FilterChangeCallback): HTMLElement {
  const state = readFiltersFromURL();

  const bar = document.createElement('div');
  bar.className = 'kb-filter-bar';

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'kb-search-input';
  searchInput.placeholder = 'Search knowledge base\u2026';
  searchInput.value = state.search;

  // Type filter
  const typeSelect = document.createElement('select');
  typeSelect.className = 'kb-type-select';
  for (const opt of ENTRY_TYPES) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === state.entryType) option.selected = true;
    typeSelect.appendChild(option);
  }

  // Tags input
  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.className = 'kb-tags-input';
  tagsInput.placeholder = 'Filter by tags\u2026';
  tagsInput.value = state.tags;

  // Sort select
  const sortSelect = document.createElement('select');
  sortSelect.className = 'kb-sort-select';
  for (const opt of SORT_OPTIONS) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === state.sort) option.selected = true;
    sortSelect.appendChild(option);
  }

  // Debounced change handler
  let debounceTimer: ReturnType<typeof setTimeout>;
  function emitChange(): void {
    const newState: KBFilterState = {
      entryType: typeSelect.value,
      search: searchInput.value.trim(),
      tags: tagsInput.value.trim(),
      sort: sortSelect.value,
    };
    writeFiltersToURL(newState);
    onChange(newState);
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emitChange, 300);
  });
  tagsInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emitChange, 300);
  });
  typeSelect.addEventListener('change', emitChange);
  sortSelect.addEventListener('change', emitChange);

  bar.appendChild(searchInput);
  bar.appendChild(typeSelect);
  bar.appendChild(tagsInput);
  bar.appendChild(sortSelect);

  return bar;
}
