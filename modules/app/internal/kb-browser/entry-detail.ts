/** Contract: contracts/app/rules.md */

import { type KBEntryRecord, fetchEntry, deleteEntryApi } from './kb-api.ts';
import { renderMetadata } from './detail-metadata.ts';
import { loadRelationships } from './detail-relationships.ts';

type DetailCallback = () => void;

/** Build the detail side-panel for a KB entry. */
export function buildDetailPanel(
  onClose: DetailCallback,
  onEdit: (entry: KBEntryRecord) => void,
  onRefresh: DetailCallback,
): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'kb-detail-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Entry detail');
  panel.hidden = true;

  const header = document.createElement('div');
  header.className = 'kb-detail__header';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kb-detail__close';
  closeBtn.textContent = '\u00D7';
  closeBtn.setAttribute('aria-label', 'Close detail panel');
  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    onClose();
  });
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'kb-detail__body';

  panel.appendChild(header);
  panel.appendChild(body);

  // Attach open method
  (panel as HTMLElement & { openEntry: (e: KBEntryRecord) => void }).openEntry =
    (entry: KBEntryRecord) => {
      renderDetail(body, entry, onEdit, onRefresh, panel);
      panel.hidden = false;
    };

  return panel;
}

/** Open the detail panel for a given entry. */
export function openDetail(panel: HTMLElement, entry: KBEntryRecord): void {
  const fn = (panel as HTMLElement & { openEntry?: (e: KBEntryRecord) => void }).openEntry;
  if (fn) fn(entry);
}

async function renderDetail(
  body: HTMLElement,
  entry: KBEntryRecord,
  onEdit: (entry: KBEntryRecord) => void,
  onRefresh: DetailCallback,
  panel: HTMLElement,
): Promise<void> {
  body.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'kb-detail__title';
  title.textContent = entry.title;

  const typeBadge = document.createElement('span');
  typeBadge.className = 'kb-detail__type';
  typeBadge.textContent = entry.entryType;

  const meta = document.createElement('div');
  meta.className = 'kb-detail__meta';
  meta.textContent = `Version ${entry.version} \u00B7 Updated ${new Date(entry.updatedAt).toLocaleString()}`;

  body.appendChild(title);
  body.appendChild(typeBadge);
  body.appendChild(meta);

  // Tags
  if (entry.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'kb-detail__tags';
    for (const tag of entry.tags) {
      const t = document.createElement('span');
      t.className = 'kb-entry-card__tag';
      t.textContent = tag;
      tagsEl.appendChild(t);
    }
    body.appendChild(tagsEl);
  }

  // Type-specific metadata
  const metaSection = renderMetadata(entry);
  if (metaSection) body.appendChild(metaSection);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'kb-detail__actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-secondary btn-sm';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', async () => {
    const fresh = await fetchEntry(entry.id);
    onEdit(fresh);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete btn-sm';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    deleteEntryApi(entry.id)
      .then(() => { panel.hidden = true; onRefresh(); })
      .catch(console.error);
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  body.appendChild(actions);

  // Relationships section (loaded async)
  const relSection = document.createElement('div');
  relSection.className = 'kb-detail__relationships';
  relSection.innerHTML = '<h3>Related Entries</h3><p class="kb-detail__loading">Loading\u2026</p>';
  body.appendChild(relSection);

  loadRelationships(entry.id, relSection);
}
