/** Contract: contracts/app-kb/rules.md */

import type { KBEntryRecord } from './kb-api.ts';
import { renderSimpleMarkdown } from './simple-markdown.ts';

/** Add a labeled field row to a parent element. */
function addField(parent: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const row = document.createElement('div');
  row.className = 'kb-detail__field';
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  row.appendChild(strong);
  row.appendChild(document.createTextNode(' '));
  const span = document.createElement('span');
  span.textContent = value;
  row.appendChild(span);
  parent.appendChild(row);
}

function renderReferenceMetadata(m: Record<string, unknown>, el: HTMLElement): HTMLElement {
  const heading = document.createElement('h3');
  heading.textContent = 'Reference Details';
  el.appendChild(heading);

  if (m.authors && Array.isArray(m.authors)) addField(el, 'Authors', (m.authors as string[]).join(', '));
  if (m.journal) addField(el, 'Journal', String(m.journal));
  if (m.year) addField(el, 'Year', String(m.year));
  if (m.volume) addField(el, 'Volume', String(m.volume));
  if (m.issue) addField(el, 'Issue', String(m.issue));
  if (m.pages) addField(el, 'Pages', String(m.pages));
  if (m.publisher) addField(el, 'Publisher', String(m.publisher));

  if (m.doi) {
    const doiRow = document.createElement('div');
    doiRow.className = 'kb-detail__field';
    const doiStrong = document.createElement('strong');
    doiStrong.textContent = 'DOI:';
    doiRow.appendChild(doiStrong);
    doiRow.appendChild(document.createTextNode(' '));
    const link = document.createElement('a');
    link.href = `https://doi.org/${m.doi}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = String(m.doi);
    doiRow.appendChild(link);
    el.appendChild(doiRow);
  }

  if (m.abstract) addField(el, 'Abstract', String(m.abstract));
  return el;
}

function renderEntityMetadata(m: Record<string, unknown>, el: HTMLElement): HTMLElement {
  const heading = document.createElement('h3');
  heading.textContent = 'Entity Details';
  el.appendChild(heading);
  if (m.entityType) addField(el, 'Subtype', String(m.entityType));
  if (m.description) addField(el, 'Description', String(m.description));
  if (m.aliases && Array.isArray(m.aliases)) addField(el, 'Aliases', (m.aliases as string[]).join(', '));
  return el;
}

function renderDatasetMetadata(m: Record<string, unknown>, el: HTMLElement): HTMLElement {
  const heading = document.createElement('h3');
  heading.textContent = 'Dataset Details';
  el.appendChild(heading);
  if (m.format) addField(el, 'Format', String(m.format));
  if (m.description) addField(el, 'Description', String(m.description));

  // Column schema summary
  if (Array.isArray(m.columns) && m.columns.length > 0) {
    const cols = m.columns as { name: string; type: string }[];
    addField(el, 'Columns', cols.map((c) => `${c.name} (${c.type})`).join(', '));
  }

  // Data preview placeholder — actual table loaded by detail-dataset.ts
  const previewSlot = document.createElement('div');
  previewSlot.className = 'kb-dataset-preview-slot';
  previewSlot.dataset.entryId = '';
  el.appendChild(previewSlot);

  return el;
}

function renderNoteMetadata(m: Record<string, unknown>, el: HTMLElement): HTMLElement {
  const heading = document.createElement('h3');
  heading.textContent = 'Note Content';
  el.appendChild(heading);
  if (m.body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'kb-detail__note-body';
    if (m.format === 'markdown') {
      bodyEl.classList.add('kb-md-content');
      bodyEl.innerHTML = renderSimpleMarkdown(String(m.body));
    } else {
      bodyEl.textContent = String(m.body);
    }
    el.appendChild(bodyEl);
  }
  if (m.format) addField(el, 'Format', String(m.format));
  return el;
}

function renderGenericMetadata(m: Record<string, unknown>, el: HTMLElement): HTMLElement {
  for (const [key, value] of Object.entries(m)) {
    if (value !== undefined && value !== null) {
      addField(el, key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }
  return el;
}

/** Render type-specific metadata into a section element. */
export function renderMetadata(entry: KBEntryRecord): HTMLElement | null {
  const m = entry.metadata;
  const section = document.createElement('div');
  section.className = 'kb-detail__metadata';

  switch (entry.entryType) {
    case 'reference': return renderReferenceMetadata(m, section);
    case 'entity': return renderEntityMetadata(m, section);
    case 'dataset': return renderDatasetMetadata(m, section);
    case 'note': return renderNoteMetadata(m, section);
    default: return renderGenericMetadata(m, section);
  }
}
