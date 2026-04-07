/** Contract: contracts/app/rules.md */

import { t } from './i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';

interface SearchResultEntry {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  updated_at: string;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

function clearDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function cancelRequest() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

/** Render search results into the target element. */
function renderResults(container: HTMLElement, results: SearchResultEntry[]) {
  container.innerHTML = '';

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'search-results-empty';
    empty.textContent = t('search.noResults');
    container.appendChild(empty);
    return;
  }

  const countEl = document.createElement('div');
  countEl.className = 'search-results-count';
  countEl.textContent = t('search.resultCount', { count: results.length });
  container.appendChild(countEl);

  for (const result of results) {
    const card = document.createElement('a');
    card.className = 'search-result-card';
    card.href = '/editor.html?doc=' + encodeURIComponent(result.id);

    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.textContent = result.title || t('editor.untitled');

    const snippet = document.createElement('div');
    snippet.className = 'search-result-snippet';
    snippet.innerHTML = result.snippet;

    const time = document.createElement('div');
    time.className = 'search-result-time';
    time.textContent = t('docList.updated', {
      time: formatRelativeTime(result.updated_at),
    });

    card.appendChild(title);
    card.appendChild(snippet);
    card.appendChild(time);
    container.appendChild(card);
  }
}

function showLoading(container: HTMLElement) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'search-results-loading';
  el.textContent = t('search.searching');
  container.appendChild(el);
}

/** Perform the search API call and render results. */
async function executeSearch(query: string, container: HTMLElement) {
  cancelRequest();
  abortController = new AbortController();

  showLoading(container);

  try {
    const res = await fetch(
      '/api/documents/search?q=' + encodeURIComponent(query),
      { signal: abortController.signal },
    );
    if (!res.ok) {
      container.innerHTML = '';
      return;
    }
    const results: SearchResultEntry[] = await res.json();
    renderResults(container, results);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      container.innerHTML = '';
    }
  }
}

/**
 * Create the search input and results container.
 * When searching, `onSearchActive(true)` is called to hide the doc list;
 * when cleared, `onSearchActive(false)` restores it.
 */
export function createGlobalSearch(
  onSearchActive: (active: boolean) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'global-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'global-search-input';
  input.placeholder = t('search.placeholder');
  input.setAttribute('aria-label', t('search.global'));

  const results = document.createElement('div');
  results.className = 'search-results';

  wrapper.appendChild(input);
  wrapper.appendChild(results);

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearDebounce();
    cancelRequest();

    if (query.length < 2) {
      results.innerHTML = '';
      onSearchActive(false);
      return;
    }

    onSearchActive(true);
    debounceTimer = setTimeout(() => {
      executeSearch(query, results);
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.innerHTML = '';
      clearDebounce();
      cancelRequest();
      onSearchActive(false);
      input.blur();
    }
  });

  return wrapper;
}
