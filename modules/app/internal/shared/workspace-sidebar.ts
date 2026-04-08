/** Contract: contracts/app/rules.md */
import { apiFetch } from './api-client.ts';
import { t } from '../i18n/index.ts';
import { formatRelativeTime } from './time-format.ts';

const COLLAPSED_KEY = 'opendesk-sidebar-collapsed';
const RECENT_KEY = 'opendesk-recent-docs';
const MAX_RECENT = 8;

interface DocEntry {
  id: string;
  title: string;
  updated_at: string;
  document_type?: string;
}

interface FolderEntry {
  id: string;
  name: string;
  parent_id: string | null;
}

interface StarredEntry extends DocEntry {
  starred_at: string;
}

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

/** Track a recently opened document. */
export function trackRecentDoc(doc: { id: string; title: string; document_type?: string }): void {
  const raw = globalThis.localStorage?.getItem(RECENT_KEY);
  let recent: Array<{ id: string; title: string; document_type?: string; openedAt: string }> = [];
  if (raw) {
    try { recent = JSON.parse(raw); } catch { /* ignore */ }
  }
  recent = recent.filter((r) => r.id !== doc.id);
  recent.unshift({ ...doc, openedAt: new Date().toISOString() });
  recent = recent.slice(0, MAX_RECENT);
  globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(recent));
}

/** Build the workspace sidebar element. */
export function buildWorkspaceSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'ws-sidebar';
  sidebar.setAttribute('aria-label', t('sidebar.workspace'));

  const isCollapsed = globalThis.localStorage?.getItem(COLLAPSED_KEY) === 'true';
  if (isCollapsed) sidebar.classList.add('ws-sidebar-collapsed');

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'ws-sidebar-toggle';
  toggleBtn.setAttribute('aria-label', t('sidebar.collapse'));
  toggleBtn.innerHTML = '<span class="ws-toggle-icon">\u{2630}</span>';
  toggleBtn.addEventListener('click', () => {
    const collapsed = sidebar.classList.toggle('ws-sidebar-collapsed');
    globalThis.localStorage?.setItem(COLLAPSED_KEY, String(collapsed));
    toggleBtn.setAttribute('aria-label', collapsed ? t('sidebar.expand') : t('sidebar.collapse'));
  });
  sidebar.appendChild(toggleBtn);

  // Content wrapper (hidden when collapsed)
  const content = document.createElement('div');
  content.className = 'ws-sidebar-content';

  // Recent section
  const recentSection = buildSection(t('sidebar.recent'), 'ws-recent');
  content.appendChild(recentSection);
  loadRecent(recentSection.querySelector('.ws-section-list')!);

  // Starred section
  const starredSection = buildSection(t('sidebar.starred'), 'ws-starred');
  content.appendChild(starredSection);
  loadStarred(starredSection.querySelector('.ws-section-list')!);

  // Folders section
  const foldersSection = buildSection(t('sidebar.folders'), 'ws-folders');
  content.appendChild(foldersSection);
  loadFolderTree(foldersSection.querySelector('.ws-section-list')!);

  // Quick search
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'ws-search-input';
  searchInput.placeholder = t('sidebar.quickSearch');
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    sidebar.querySelectorAll('.ws-item').forEach((el) => {
      const text = el.textContent?.toLowerCase() || '';
      (el as HTMLElement).style.display = query && !text.includes(query) ? 'none' : '';
    });
  });
  content.appendChild(searchInput);

  sidebar.appendChild(content);
  return sidebar;
}

function buildSection(label: string, id: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ws-section';
  section.id = id;

  const header = document.createElement('button');
  header.className = 'ws-section-header';
  header.textContent = label;
  header.addEventListener('click', () => {
    section.classList.toggle('ws-section-collapsed');
  });

  const list = document.createElement('div');
  list.className = 'ws-section-list';

  section.appendChild(header);
  section.appendChild(list);
  return section;
}

function loadRecent(container: HTMLElement): void {
  const raw = globalThis.localStorage?.getItem(RECENT_KEY);
  if (!raw) {
    container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`;
    return;
  }
  try {
    const recent: Array<{ id: string; title: string; document_type?: string; openedAt: string }> = JSON.parse(raw);
    if (!recent.length) {
      container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`;
      return;
    }
    for (const doc of recent) {
      container.appendChild(buildDocItem(doc.id, doc.title, doc.document_type));
    }
  } catch {
    container.innerHTML = `<div class="ws-empty">${t('sidebar.noRecent')}</div>`;
  }
}

async function loadStarred(container: HTMLElement): Promise<void> {
  try {
    const res = await apiFetch('/api/starred');
    if (!res.ok) return;
    const items: StarredEntry[] = await res.json();
    if (!items.length) {
      container.innerHTML = `<div class="ws-empty">${t('sidebar.noStarred')}</div>`;
      return;
    }
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
  } catch {
    container.innerHTML = `<div class="ws-empty">${t('sidebar.noStarred')}</div>`;
  }
}

async function loadFolderTree(container: HTMLElement, parentId: string | null = null, depth = 0): Promise<void> {
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
      row.addEventListener('click', () => {
        window.location.href = `/?folder=${encodeURIComponent(folder.id)}`;
      });
      container.appendChild(row);
      // Load children recursively (max 2 levels for performance)
      if (depth < 2) {
        await loadFolderTree(container, folder.id, depth + 1);
      }
    }
  } catch { /* silent */ }
}

function buildDocItem(id: string, title: string, docType?: string): HTMLElement {
  const type = docType || 'text';
  const icon = TYPE_ICONS[type] || TYPE_ICONS.text;
  const editor = TYPE_EDITORS[type] || TYPE_EDITORS.text;

  const row = document.createElement('a');
  row.className = 'ws-item';
  row.href = `${editor}?doc=${encodeURIComponent(id)}`;

  const iconEl = document.createElement('span');
  iconEl.className = 'ws-item-icon';
  iconEl.textContent = icon;

  const name = document.createElement('span');
  name.className = 'ws-item-name';
  name.textContent = title || t('editor.untitled');

  row.appendChild(iconEl);
  row.appendChild(name);
  return row;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
