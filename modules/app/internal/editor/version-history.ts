/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { apiFetch } from '../shared/api-client.ts';
import { t, onLocaleChange } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { getDocumentId } from '../shared/identity.ts';
import { promptVersionName } from './version-name-dialog.ts';

/** Auto-snapshot fires after this many ms of inactivity following an edit. */
const AUTO_SNAPSHOT_DEBOUNCE_MS = 7 * 60 * 1000;

interface VersionEntry {
  id: string;
  document_id: string;
  title: string;
  created_by: string;
  created_at: string;
  version_number: number;
}

const enc = encodeURIComponent;

async function fetchVersions(docId: string): Promise<VersionEntry[]> {
  const res = await apiFetch(`/api/documents/${enc(docId)}/versions`);
  if (!res.ok) return [];
  return res.json();
}

async function createVersion(docId: string, name?: string): Promise<VersionEntry | null> {
  const res = await apiFetch(`/api/documents/${enc(docId)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function restoreVersion(docId: string, versionId: string): Promise<boolean> {
  const res = await apiFetch(`/api/documents/${enc(docId)}/versions/${enc(versionId)}/restore`, { method: 'POST' });
  return res.ok;
}

async function removeVersion(docId: string, versionId: string): Promise<boolean> {
  const res = await apiFetch(`/api/documents/${enc(docId)}/versions/${enc(versionId)}`, { method: 'DELETE' });
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

  function mkBtn(cls: string, labelKey: Parameters<typeof t>[0], onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = t(labelKey);
    btn.addEventListener('click', onClick);
    return btn;
  }

  actions.appendChild(mkBtn('version-action-btn', 'versions.restore', async () => {
    if (!confirm(t('versions.restoreConfirm'))) return;
    if (await restoreVersion(docId, version.id)) window.location.reload();
  }));
  actions.appendChild(mkBtn('version-action-btn version-action-delete', 'versions.delete', async () => {
    if (!confirm(t('versions.deleteConfirm'))) return;
    if (await removeVersion(docId, version.id)) onRefresh();
  }));
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
    const name = await promptVersionName();
    if (name === null) return; // user cancelled
    await createVersion(docId, name || undefined);
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
      return;
    }
    for (const v of versions) {
      listEl.appendChild(renderVersionCard(v, docId, refresh));
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

/** Wire auto-snapshots to editor update events. Returns cleanup function. */
export function startAutoSnapshot(editor: Editor): () => void {
  const docId = getDocumentId();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onUpdate = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      await createVersion(docId, `${t('versions.autoSaveLabel')} \u2014 ${new Date().toLocaleTimeString()}`);
    }, AUTO_SNAPSHOT_DEBOUNCE_MS);
  };
  editor.on('update', onUpdate);
  return () => { editor.off('update', onUpdate); if (timer !== null) clearTimeout(timer); };
}
