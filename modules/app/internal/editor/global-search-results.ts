/** Contract: contracts/app/rules.md */

import { t } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';

/** Escape HTML to prevent XSS, then restore only <mark> tags from ts_headline. */
export function sanitizeSnippet(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

export interface SearchResultEntry {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  content_type: string;
  updated_at: string;
}

export interface GroupedSearchResponse {
  query: string;
  total: number;
  groups: Record<string, SearchResultEntry[]>;
}

/** SVG icons for each content type (inline, no external deps). */
const TYPE_ICONS: Record<string, string> = {
  document: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  spreadsheet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  presentation: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  kb: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
};

const TYPE_LABELS: Record<string, () => string> = {
  document: () => t('search.typeDocument'),
  spreadsheet: () => t('search.typeSheet'),
  presentation: () => t('search.typeSlides'),
  kb: () => t('search.typeKb'),
};

const EDITOR_PATHS: Record<string, string> = {
  document: '/editor.html',
  spreadsheet: '/spreadsheet.html',
  presentation: '/presentation.html',
  kb: '/kb.html',
};

/** Render a single result card. */
function renderCard(result: SearchResultEntry): HTMLAnchorElement {
  const editorPath = EDITOR_PATHS[result.content_type] ?? '/editor.html';
  const card = document.createElement('a');
  card.className = 'search-result-card';
  card.href = editorPath + '?doc=' + encodeURIComponent(result.id);

  const header = document.createElement('div');
  header.className = 'search-result-header';

  const iconEl = document.createElement('span');
  iconEl.className = 'search-result-icon';
  iconEl.innerHTML = TYPE_ICONS[result.content_type] ?? TYPE_ICONS.document;

  const title = document.createElement('span');
  title.className = 'search-result-title';
  title.textContent = result.title || t('editor.untitled');

  const badge = document.createElement('span');
  badge.className = 'search-result-badge search-result-badge--' + result.content_type;
  badge.textContent = (TYPE_LABELS[result.content_type] ?? TYPE_LABELS.document)();

  header.append(iconEl, title, badge);

  const snippet = document.createElement('div');
  snippet.className = 'search-result-snippet';
  snippet.innerHTML = sanitizeSnippet(result.snippet);

  const time = document.createElement('div');
  time.className = 'search-result-time';
  time.textContent = t('docList.updated', { time: formatRelativeTime(result.updated_at) });

  card.append(header, snippet, time);
  return card;
}

/** Render grouped search results into the container. */
export function renderGroupedResults(
  container: HTMLElement,
  data: GroupedSearchResponse,
): void {
  container.innerHTML = '';

  if (data.total === 0) {
    renderEmptyResults(container);
    return;
  }

  const countEl = document.createElement('div');
  countEl.className = 'search-results-count';
  countEl.textContent = t('search.resultCount', { count: data.total });
  container.appendChild(countEl);

  const typeOrder = ['document', 'spreadsheet', 'presentation', 'kb'];
  for (const type of typeOrder) {
    const items = data.groups[type];
    if (!items?.length) continue;

    const group = document.createElement('div');
    group.className = 'search-results-group';

    const label = document.createElement('div');
    label.className = 'search-results-group-label';
    label.innerHTML = (TYPE_ICONS[type] ?? '') + ' ' +
      (TYPE_LABELS[type] ?? TYPE_LABELS.document)();
    group.appendChild(label);

    for (const result of items) {
      group.appendChild(renderCard(result));
    }
    container.appendChild(group);
  }
}

/** Render empty state with search tips. */
function renderEmptyResults(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'search-results-empty';

  const title = document.createElement('div');
  title.className = 'search-empty-title';
  title.textContent = t('search.noResults');

  const tips = document.createElement('div');
  tips.className = 'search-empty-tips';
  const tipTitle = document.createElement('strong');
  tipTitle.textContent = t('search.tipTitle');
  const tipContent = document.createElement('p');
  tipContent.textContent = t('search.tipContent');
  tips.append(tipTitle, tipContent);

  wrapper.append(title, tips);
  container.appendChild(wrapper);
}
