/** Contract: contracts/app/rules.md */
import { apiFetch } from '../shared/api-client.ts';
import { t, onLocaleChange } from '../i18n/index.ts';
import { formatRelativeTime } from '../shared/time-format.ts';
import { getDocumentId } from '../shared/identity.ts';
import type { PanelBlock } from './panel-system.ts';

interface VersionEntry {
  id: string;
  document_id: string;
  title: string;
  created_by: string;
  created_at: string;
  version_number: number;
}

export function buildVersionsBlock(): PanelBlock {
  const docId = getDocumentId();
  const content = document.createElement('div');
  content.className = 'versions-block';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'comment-action-btn';
  saveBtn.textContent = t('versions.save');
  saveBtn.addEventListener('click', async () => {
    await createVersion(docId);
    await refresh();
  });
  content.appendChild(saveBtn);

  const list = document.createElement('div');
  list.className = 'versions-block-list';
  content.appendChild(list);

  async function refresh() {
    const versions = await fetchVersions(docId);
    list.innerHTML = '';
    if (versions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'versions-block-empty';
      empty.textContent = t('versions.noVersions');
      list.appendChild(empty);
      return;
    }
    for (const v of versions) {
      list.appendChild(renderCard(v, docId, refresh));
    }
  }

  refresh();
  const unsubLocale = onLocaleChange(() => {
    saveBtn.textContent = t('versions.save');
    refresh();
  });

  return {
    id: 'versions',
    title: t('versions.title'),
    content,
    cleanup: unsubLocale,
  };
}

function renderCard(v: VersionEntry, docId: string, onRefresh: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'version-card';

  const label = document.createElement('div');
  label.className = 'version-card-label';
  label.textContent = v.title || t('versions.versionNumber', { n: v.version_number });

  const meta = document.createElement('div');
  meta.className = 'version-card-meta';
  meta.textContent = `${v.created_by || 'Unknown'} \u00b7 ${formatRelativeTime(v.created_at)}`;

  const actions = document.createElement('div');
  actions.className = 'version-card-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'comment-action-btn';
  restoreBtn.textContent = t('versions.restore');
  restoreBtn.addEventListener('click', async () => {
    if (!confirm(t('versions.restoreConfirm'))) return;
    const ok = await restoreVersion(docId, v.id);
    if (ok) window.location.reload();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'comment-action-btn comment-action-delete';
  deleteBtn.textContent = t('versions.delete');
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(t('versions.deleteConfirm'))) return;
    const ok = await removeVersion(docId, v.id);
    if (ok) onRefresh();
  });

  actions.append(restoreBtn, deleteBtn);
  card.append(label, meta, actions);
  return card;
}

async function fetchVersions(docId: string): Promise<VersionEntry[]> {
  const res = await apiFetch(`/api/documents/${encodeURIComponent(docId)}/versions`);
  if (!res.ok) return [];
  return res.json();
}

async function createVersion(docId: string): Promise<void> {
  await apiFetch(`/api/documents/${encodeURIComponent(docId)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
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
