/** Contract: contracts/app/rules.md */
import { apiFetch } from './api-client.ts';
import { t, onLocaleChange } from './i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';
import { getDocumentId } from './identity.ts';

interface VersionEntry {
  id: string;
  document_id: string;
  title: string;
  created_by: string;
  created_at: string;
  version_number: number;
}

async function fetchVersions(docId: string): Promise<VersionEntry[]> {
  const res = await apiFetch(`/api/documents/${encodeURIComponent(docId)}/versions`);
  if (!res.ok) return [];
  return res.json();
}

async function createVersion(docId: string, name?: string): Promise<VersionEntry | null> {
  const res = await apiFetch(`/api/documents/${encodeURIComponent(docId)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function restoreVersion(docId: string, versionId: string): Promise<boolean> {
  const res = await apiFetch(
    `/api/documents/${encodeURIComponent(docId)}/versions/${encodeURIComponent(versionId)}/restore`,
    { method: 'POST' },
  );
  return res.ok;
}

async function removeVersion(docId: string, versionId: string): Promise<boolean> {
  const res = await apiFetch(
    `/api/documents/${encodeURIComponent(docId)}/versions/${encodeURIComponent(versionId)}`,
    { method: 'DELETE' },
  );
  return res.ok;
}

function renderVersionCard(
  version: VersionEntry,
  docId: string,
  onRefresh: () => void,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'version-card';

  const header = document.createElement('div');
  header.className = 'version-card-header';

  const label = document.createElement('span');
  label.className = 'version-card-label';
  label.textContent = version.title || t('versions.versionNumber', { n: version.version_number });

  const number = document.createElement('span');
  number.className = 'version-card-number';
  number.textContent = `#${version.version_number}`;

  header.appendChild(label);
  header.appendChild(number);

  const meta = document.createElement('div');
  meta.className = 'version-card-meta';
  meta.textContent = `${version.created_by || 'Unknown'} \u00b7 ${formatRelativeTime(version.created_at)}`;

  const actions = document.createElement('div');
  actions.className = 'version-card-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'version-action-btn';
  restoreBtn.textContent = t('versions.restore');
  restoreBtn.addEventListener('click', async () => {
    if (!confirm(t('versions.restoreConfirm'))) return;
    const ok = await restoreVersion(docId, version.id);
    if (ok) window.location.reload();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'version-action-btn version-action-delete';
  deleteBtn.textContent = t('versions.delete');
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(t('versions.deleteConfirm'))) return;
    const ok = await removeVersion(docId, version.id);
    if (ok) onRefresh();
  });

  actions.appendChild(restoreBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(header);
  card.appendChild(meta);
  card.appendChild(actions);
  return card;
}

/**
 * Build the version history sidebar panel.
 * Returns the sidebar element to be appended to the DOM.
 */
export function buildVersionSidebar(): HTMLElement {
  const docId = getDocumentId();
  const sidebar = document.createElement('aside');
  sidebar.className = 'version-sidebar';
  sidebar.setAttribute('aria-label', t('versions.title'));

  const headerEl = document.createElement('div');
  headerEl.className = 'version-sidebar-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'version-sidebar-title';
  titleEl.textContent = t('versions.title');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'version-sidebar-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.setAttribute('aria-label', t('versions.close'));
  closeBtn.addEventListener('click', () => toggleVersionSidebar(sidebar, false));

  headerEl.appendChild(titleEl);
  headerEl.appendChild(closeBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'version-save-btn';
  saveBtn.textContent = t('versions.save');
  saveBtn.addEventListener('click', async () => {
    await createVersion(docId);
    await refresh();
  });

  const listEl = document.createElement('div');
  listEl.className = 'version-sidebar-list';

  sidebar.appendChild(headerEl);
  sidebar.appendChild(saveBtn);
  sidebar.appendChild(listEl);

  async function refresh() {
    const versions = await fetchVersions(docId);
    listEl.innerHTML = '';
    if (versions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'version-sidebar-empty';
      empty.textContent = t('versions.noVersions');
      listEl.appendChild(empty);
    } else {
      for (const v of versions) {
        listEl.appendChild(renderVersionCard(v, docId, refresh));
      }
    }
  }

  sidebar.addEventListener('version-sidebar-open', () => { refresh(); });

  onLocaleChange(() => {
    titleEl.textContent = t('versions.title');
    closeBtn.setAttribute('aria-label', t('versions.close'));
    saveBtn.textContent = t('versions.save');
    sidebar.setAttribute('aria-label', t('versions.title'));
    refresh();
  });

  return sidebar;
}

/** Toggle the version sidebar open/closed. */
export function toggleVersionSidebar(sidebar: HTMLElement, force?: boolean): void {
  const isOpen = force ?? !sidebar.classList.contains('version-sidebar-open');
  sidebar.classList.toggle('version-sidebar-open', isOpen);
  if (isOpen) {
    sidebar.dispatchEvent(new CustomEvent('version-sidebar-open'));
  }
}
