/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';
import { renderRecentSearches } from './global-search-recent.ts';
import { clearDebounce, cancelRequest, executeSearch, scheduleSearch } from './global-search-fetch.ts';

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
  shortcutHint.textContent = isMac() ? '\u2318K' : 'Ctrl+K';

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
    scheduleSearch(query, results);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.innerHTML = '';
      clearDebounce();
      cancelRequest();
      onSearchActive(false);
      input.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = results.querySelector<HTMLElement>('.search-result-card');
      first?.focus();
    }
  });

  results.addEventListener('keydown', (e) => {
    const cards = Array.from(
      results.querySelectorAll<HTMLElement>('.search-result-card'),
    );
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? cards.indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cards.length - 1) cards[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) {
        input.focus();
      } else {
        cards[idx - 1].focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      results.innerHTML = '';
      clearDebounce();
      cancelRequest();
      onSearchActive(false);
      input.focus();
    }
  });

  // Cmd/Ctrl+K global shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  return wrapper;
}
