/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';

const STORAGE_KEY = 'opendesk-recent-searches';
const MAX_RECENT = 8;

/** Load recent searches from localStorage. */
export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Save a search query to recent searches. */
export function saveRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;

  const recent = loadRecentSearches().filter((q) => q !== trimmed);
  recent.unshift(trimmed);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

/** Clear all recent searches. */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Render recent searches panel. Returns null if no recent searches. */
export function renderRecentSearches(
  onSelect: (query: string) => void,
): HTMLElement | null {
  const recent = loadRecentSearches();
  if (!recent.length) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-recent';

  const header = document.createElement('div');
  header.className = 'search-recent-header';

  const title = document.createElement('span');
  title.className = 'search-recent-title';
  title.textContent = t('search.recentTitle');

  const clearBtn = document.createElement('button');
  clearBtn.className = 'search-recent-clear';
  clearBtn.textContent = t('search.clearRecent');
  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearRecentSearches();
    wrapper.remove();
  });

  header.append(title, clearBtn);
  wrapper.appendChild(header);

  for (const query of recent) {
    const item = document.createElement('button');
    item.className = 'search-recent-item';
    item.textContent = query;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      onSelect(query);
    });
    wrapper.appendChild(item);
  }

  return wrapper;
}
