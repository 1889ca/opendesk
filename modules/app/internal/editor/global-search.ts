/** Contract: contracts/app/rules.md */

import { apiFetch } from '../shared/api-client.ts';
import { t } from '../i18n/index.ts';
import { renderGroupedResults, type GroupedSearchResponse } from './global-search-results.ts';
import { saveRecentSearch, renderRecentSearches } from './global-search-recent.ts';
import { attachResultsKeyNav, registerSearchShortcut } from './global-search-keyboard.ts';

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

function showLoading(container: HTMLElement) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'search-results-loading';
  el.textContent = t('search.searching');
  container.appendChild(el);
}

/** Perform the search API call and render grouped results. */
async function executeSearch(query: string, container: HTMLElement) {
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

/** Show empty state with tips and recent searches. */
function showIdleState(container: HTMLElement, triggerSearch: (q: string) => void) {
  container.innerHTML = '';
  const recentEl = renderRecentSearches((query) => triggerSearch(query));
  if (recentEl) {
    container.appendChild(recentEl);
  } else {
    const tips = document.createElement('div');
    tips.className = 'search-empty-tips';
    const strong = document.createElement('strong');
    strong.textContent = t('search.tipTitle');
    const p = document.createElement('p');
    p.textContent = t('search.tipContent');
    tips.append(strong, p);
    container.appendChild(tips);
  }
}

/** Detect Mac vs other platforms for shortcut display. */
function isMac(): boolean {
  return navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac');
}

/**
 * Create the global search input and results container.
 * Supports Cmd/Ctrl+K keyboard shortcut to focus.
 * When searching, `onSearchActive(true)` hides the doc list;
 * when cleared, `onSearchActive(false)` restores it.
 */
export function createGlobalSearch(
  onSearchActive: (active: boolean) => void,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'global-search';

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'global-search-input-wrapper';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'global-search-input';
  input.placeholder = t('search.placeholder');
  input.setAttribute('aria-label', t('search.global'));

  const shortcutHint = document.createElement('kbd');
  shortcutHint.className = 'global-search-shortcut';
  shortcutHint.textContent = isMac() ? '⌘K' : 'Ctrl+K';

  inputWrapper.append(input, shortcutHint);

  const results = document.createElement('div');
  results.className = 'search-results';

  wrapper.append(inputWrapper, results);

  /** Trigger a search from external input (e.g. recent searches click). */
  function triggerSearch(query: string) {
    input.value = query;
    input.focus();
    clearDebounce();
    cancelRequest();
    if (query.length < 2) {
      results.innerHTML = '';
      onSearchActive(false);
      return;
    }
    onSearchActive(true);
    executeSearch(query, results);
  }

  function closeSearch() {
    input.value = '';
    results.innerHTML = '';
    clearDebounce();
    cancelRequest();
    onSearchActive(false);
  }

  input.addEventListener('focus', () => {
    if (input.value.trim().length < 2) {
      showIdleState(results, triggerSearch);
      onSearchActive(true);
    }
  });

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearDebounce();
    cancelRequest();

    if (query.length < 2) {
      showIdleState(results, triggerSearch);
      onSearchActive(true);
      return;
    }

    onSearchActive(true);
    debounceTimer = setTimeout(() => {
      executeSearch(query, results);
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
      input.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = results.querySelector<HTMLElement>('.search-result-card');
      first?.focus();
    }
  });

  attachResultsKeyNav(results, input, closeSearch);
  registerSearchShortcut(input);

  return wrapper;
}
