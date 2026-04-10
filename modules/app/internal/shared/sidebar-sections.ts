/** Contract: contracts/app/rules.md */
import { apiFetch } from './api-client.ts';
import { t } from '../i18n/index.ts';

const RECENT_KEY = 'opendesk-recent-docs';
const MAX_RECENT = 8;

const TYPE_EDITORS: Record<string, string> = {
  text: '/editor.html',
  spreadsheet: '/spreadsheet.html',
  presentation: '/presentation.html',
};

const TYPE_ICONS: Record<string, string> = {
  text: '\u{1F4C4}',
  spreadsheet: '\u{1F4CA}',
  presentation: '\u{1F3AC}',
};

interface FolderEntry {
  id: string;
  name: string;
  parent_id: string | null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDocItem(id: string, title: string, docType?: string): HTMLElement {
  const type = docType || 'text';
  const row = document.createElement('a');
  row.className = 'ws-item';
  row.href = `${TYPE_EDITORS[type] || TYPE_EDITORS.text}?doc=${encodeURIComponent(id)}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'ws-item-icon';
  iconEl.textContent = TYPE_ICONS[type] || TYPE_ICONS.text;

  const name = document.createElement('span');
  name.className = 'ws-item-name';
  name.textContent = title || t('editor.untitled');

  row.appendChild(iconEl);
  row.appendChild(name);
  return row;
}

/** Track a recently opened document in localStorage. */
export function trackRecentDoc(doc: { id: string; title: string; document_type?: string }): void {
  const raw = globalThis.localStorage?.getItem(RECENT_KEY);
  let recent: Array<{ id: string; title: string; document_type?: string; openedAt: string }> = [];
  if (raw) { try { recent = JSON.parse(raw); } catch { /* ignore */ } }
  recent = recent.filter((r) => r.id !== doc.id);
  recent.unshift({ ...doc, openedAt: new Date().toISOString() });
  recent = recent.slice(0, MAX_RECENT);
  globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(recent));
}

/** Load recent documents from localStorage into a container. */
export function loadRecent(container: HTMLElement): void {
  const raw = globalThis.localStorage?.getItem(RECENT_KEY);
  if (!raw) { container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`; return; }
  try {
    const recent: Array<{ id: string; title: string; document_type?: string }> = JSON.parse(raw);
    if (!recent.length) { container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`; return; }
    for (const doc of recent) container.appendChild(buildDocItem(doc.id, doc.title, doc.document_type));
  } catch { container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`; }
}

/** Load starred documents from API into a container. */
export async function loadStarred(container: HTMLElement): Promise<void> {
  try {
    const res = await apiFetch('/api/starred');
    if (!res.ok) return;
    const items: Array<{ id: string; title: string; document_type?: string }> = await res.json();
    if (!items.length) { container.innerHTML = `<div class="ws-empty ws-empty--starred">${t('sidebar.noStarred')}</div>`; return; }
    for (const item of items) {
      const row = buildDocItem(item.id, item.title, item.document_type);
      const unstarBtn = document.createElement('button');
      unstarBtn.className = 'ws-unstar-btn';
      unstarBtn.title = t('sidebar.unstar');
      unstarBtn.textContent = '\u2605';
      unstarBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await apiFetch(`/api/starred/${item.id}`, { method: 'DELETE' });
        row.remove();
        if (!container.querySelector('.ws-item')) {
          container.innerHTML = `<div class="ws-empty">${t('sidebar.noStarred')}</div>`;
        }
      });
      row.appendChild(unstarBtn);
      container.appendChild(row);
    }
  } catch { container.innerHTML = `<div class="ws-empty">${t('sidebar.noStarred')}</div>`; }
}

/** Load folder tree recursively into a container. */
export async function loadFolderTree(
  container: HTMLElement,
  parentId: string | null = null,
  depth = 0,
): Promise<void> {
  try {
    const url = parentId ? `/api/folders?parentId=${encodeURIComponent(parentId)}` : '/api/folders';
    const res = await apiFetch(url);
    if (!res.ok) return;
    const folders: FolderEntry[] = await res.json();
    for (const folder of folders) {
      const row = document.createElement('div');
      row.className = 'ws-item ws-folder-item';
      row.style.paddingLeft = `${0.5 + depth * 0.75}rem`;
      row.innerHTML = `<span class="ws-item-icon">\u{1F4C1}</span><span class="ws-item-name">${escapeHtml(folder.name)}</span>`;
      row.addEventListener('click', () => { window.location.href = `/?folder=${encodeURIComponent(folder.id)}`; });
      container.appendChild(row);
      if (depth < 2) await loadFolderTree(container, folder.id, depth + 1);
    }
  } catch { /* silent */ }
}
