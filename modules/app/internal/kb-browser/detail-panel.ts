/** Contract: contracts/app/rules.md */

import {
  fetchVersions,
  transitionEntry,
  updateEntry,
  deleteEntry,
  type KbEntryData,
  type KbVersionData,
} from './kb-api.ts';
import { buildKbUri, type KbEntryStatus } from '../../../kb/contract.ts';
import { createStatusBadge, createTransitionButtons } from './status-badge.ts';
import { formatRelativeTime } from '../shared/time-format.ts';

export interface DetailPanelCallbacks {
  onUpdate: () => void;
  onClose: () => void;
}

/**
 * Render the detail panel for a single KB entry.
 * Shows metadata, status transitions, version history, and reference URIs.
 */
export function renderDetailPanel(
  container: HTMLElement,
  entry: KbEntryData,
  callbacks: DetailPanelCallbacks,
): void {
  container.innerHTML = '';
  container.className = 'kb-detail-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'kb-detail-header';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn kb-detail-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', callbacks.onClose);

  const titleEl = document.createElement('h2');
  titleEl.className = 'kb-detail-title';
  titleEl.textContent = entry.title;

  const badge = createStatusBadge(entry.status);
  const versionLabel = document.createElement('span');
  versionLabel.className = 'kb-detail-version';
  versionLabel.textContent = `v${entry.version}`;

  header.append(closeBtn, titleEl, badge, versionLabel);
  container.appendChild(header);

  // Metadata
  const meta = document.createElement('div');
  meta.className = 'kb-detail-meta';
  meta.innerHTML = `
    <span>Created ${formatRelativeTime(entry.created_at)}</span>
    <span>Updated ${formatRelativeTime(entry.updated_at)}</span>
    <span>By ${entry.created_by}</span>
  `;
  container.appendChild(meta);

  // Body preview
  const bodySection = document.createElement('div');
  bodySection.className = 'kb-detail-body';
  const bodyText = document.createElement('p');
  bodyText.textContent = entry.body || '(empty)';
  bodySection.appendChild(bodyText);
  container.appendChild(bodySection);

  // Tags
  if (entry.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'kb-detail-tags';
    for (const tag of entry.tags) {
      const tagEl = document.createElement('span');
      tagEl.className = 'kb-tag';
      tagEl.textContent = tag;
      tagsEl.appendChild(tagEl);
    }
    container.appendChild(tagsEl);
  }

  // Reference URIs
  const refSection = document.createElement('div');
  refSection.className = 'kb-detail-refs';
  const refTitle = document.createElement('h3');
  refTitle.textContent = 'Reference URIs';
  refSection.appendChild(refTitle);

  const pinnedUri = buildKbUri({ entryId: entry.id, version: entry.version });
  const latestUri = buildKbUri({ entryId: entry.id, version: 'latest' });

  for (const [label, uri] of [['Pinned', pinnedUri], ['Latest', latestUri]]) {
    const row = document.createElement('div');
    row.className = 'kb-ref-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'kb-ref-label';
    labelEl.textContent = `${label}:`;
    const codeEl = document.createElement('code');
    codeEl.className = 'kb-ref-uri';
    codeEl.textContent = uri;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn kb-ref-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(uri).catch(console.error);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
    row.append(labelEl, codeEl, copyBtn);
    refSection.appendChild(row);
  }
  container.appendChild(refSection);

  // Status transitions
  const transitionSection = document.createElement('div');
  transitionSection.className = 'kb-detail-transitions';
  const buttons = createTransitionButtons(entry.status, async (to: KbEntryStatus) => {
    try {
      await transitionEntry(entry.id, to);
      callbacks.onUpdate();
    } catch (err) {
      console.error('Transition failed', err);
      alert(err instanceof Error ? err.message : 'Transition failed');
    }
  });
  for (const btn of buttons) transitionSection.appendChild(btn);
  container.appendChild(transitionSection);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'kb-detail-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-delete kb-delete-btn';
  deleteBtn.textContent = 'Delete Entry';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    try {
      await deleteEntry(entry.id);
      callbacks.onUpdate();
      callbacks.onClose();
    } catch (err) {
      console.error('Delete failed', err);
    }
  });
  actions.appendChild(deleteBtn);
  container.appendChild(actions);

  // Version history (loaded async)
  const versionsSection = document.createElement('div');
  versionsSection.className = 'kb-detail-versions';
  const versionsTitle = document.createElement('h3');
  versionsTitle.textContent = 'Version History';
  versionsSection.appendChild(versionsTitle);
  container.appendChild(versionsSection);

  loadVersions(versionsSection, entry.id);
}

async function loadVersions(container: HTMLElement, entryId: string): Promise<void> {
  try {
    const versions = await fetchVersions(entryId);
    if (versions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'kb-versions-empty';
      empty.textContent = 'No version history.';
      container.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'kb-version-list';
    for (const v of versions) {
      const item = document.createElement('li');
      item.className = 'kb-version-item';
      item.innerHTML = `
        <span class="kb-version-num">v${v.version}</span>
        <span class="kb-version-title">${v.title}</span>
        <span class="kb-version-time">${formatRelativeTime(v.created_at)}</span>
      `;
      list.appendChild(item);
    }
    container.appendChild(list);
  } catch (err) {
    console.error('Failed to load versions', err);
  }
}
