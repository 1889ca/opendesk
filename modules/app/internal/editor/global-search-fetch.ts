/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { renderGroupedResults, type GroupedSearchResponse } from './global-search-results.ts';
import { saveRecentSearch } from './global-search-recent.ts';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

export function clearDebounce() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

export function cancelRequest() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

function showLoading(container: HTMLElement) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'search-results-loading';
  el.textContent = t('search.searching');
  container.appendChild(el);
}

/** Schedule a debounced search (300ms). Cancels any pending debounce first. */
export function scheduleSearch(query: string, container: HTMLElement): void {
  clearDebounce();
  debounceTimer = setTimeout(() => { executeSearch(query, container); }, 300);
}

/** Perform the search API call and render grouped results. */
export async function executeSearch(query: string, container: HTMLElement) {
  cancelRequest();
  abortController = new AbortController();
  showLoading(container);

  try {
    const res = await apiFetch(
      '/api/search?q=' + encodeURIComponent(query),
      { signal: abortController.signal },
    );
    if (!res.ok) {
      container.innerHTML = '';
      return;
    }
    const data: GroupedSearchResponse = await res.json();
    renderGroupedResults(container, data);
    saveRecentSearch(query);
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      container.innerHTML = '';
    }
  }
}
