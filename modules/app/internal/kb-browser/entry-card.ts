/** Contract: contracts/app/rules.md */

import type { KBEntryRecord } from './kb-api.ts';

const TYPE_LABELS: Record<string, string> = {
  reference: 'Reference',
  entity: 'Entity',
  dataset: 'Dataset',
  note: 'Note',
  glossary: 'Glossary',
};

const TYPE_COLORS: Record<string, string> = {
  reference: '#2563eb',
  entity: '#7c3aed',
  dataset: '#059669',
  note: '#d97706',
  glossary: '#dc2626',
};

/** Escape HTML then restore only <mark> tags used by search highlighting. */
function sanitizeSnippet(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

/** Format a date string to a relative or short format. */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/** Build a preview snippet from entry metadata. */
function buildSnippet(entry: KBEntryRecord): string {
  if (entry.snippet) return entry.snippet;
  const m = entry.metadata;
  switch (entry.entryType) {
    case 'reference': {
      const parts: string[] = [];
      if (m.authors && Array.isArray(m.authors) && m.authors.length > 0) {
        parts.push((m.authors as string[]).slice(0, 2).join(', '));
      }
      if (m.journal) parts.push(String(m.journal));
      if (m.year) parts.push(String(m.year));
      return parts.join(' \u00B7 ');
    }
    case 'entity': {
      const parts: string[] = [];
      if (m.entityType) parts.push(String(m.entityType));
      if (m.description) parts.push(String(m.description).slice(0, 100));
      return parts.join(' \u2014 ');
    }
    case 'dataset':
      return m.description ? String(m.description).slice(0, 120) : (m.format ? `Format: ${m.format}` : '');
    case 'note':
      return m.body ? String(m.body).slice(0, 120) : '';
    default:
      return '';
  }
}

/** Create a single entry card element. */
export function createEntryCard(
  entry: KBEntryRecord,
  onClick: (entry: KBEntryRecord) => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'kb-entry-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View ${entry.title}`);

  // Header row: badge + title
  const header = document.createElement('div');
  header.className = 'kb-entry-card__header';

  const badge = document.createElement('span');
  badge.className = 'kb-entry-card__badge';
  badge.style.backgroundColor = TYPE_COLORS[entry.entryType] ?? '#6b7280';
  badge.textContent = TYPE_LABELS[entry.entryType] ?? entry.entryType;

  const title = document.createElement('span');
  title.className = 'kb-entry-card__title';
  title.textContent = entry.title;

  header.appendChild(badge);
  header.appendChild(title);

  // Snippet
  const snippet = buildSnippet(entry);
  const snippetEl = document.createElement('div');
  snippetEl.className = 'kb-entry-card__snippet';
  if (entry.snippet) {
    snippetEl.innerHTML = sanitizeSnippet(snippet); // search snippets contain <mark> tags
  } else {
    snippetEl.textContent = snippet;
  }

  // Footer: tags + date
  const footer = document.createElement('div');
  footer.className = 'kb-entry-card__footer';

  if (entry.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'kb-entry-card__tags';
    for (const tag of entry.tags.slice(0, 4)) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'kb-entry-card__tag';
      tagSpan.textContent = tag;
      tagsEl.appendChild(tagSpan);
    }
    if (entry.tags.length > 4) {
      const more = document.createElement('span');
      more.className = 'kb-entry-card__tag kb-entry-card__tag--more';
      more.textContent = `+${entry.tags.length - 4}`;
      tagsEl.appendChild(more);
    }
    footer.appendChild(tagsEl);
  }

  const dateEl = document.createElement('span');
  dateEl.className = 'kb-entry-card__date';
  dateEl.textContent = formatDate(entry.updatedAt);
  footer.appendChild(dateEl);

  card.appendChild(header);
  if (snippet) card.appendChild(snippetEl);
  card.appendChild(footer);

  card.addEventListener('click', () => onClick(entry));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(entry);
    }
  });

  return card;
}
