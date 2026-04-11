/** Contract: contracts/app/rules.md */
import { t } from '../i18n/index.ts';
import { loadRecent, loadStarred, loadFolderTree } from './sidebar-sections.ts';

export { trackRecentDoc } from './sidebar-sections.ts';

const COLLAPSED_KEY = 'opendesk-sidebar-collapsed';

function buildSection(label: string, id: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'ws-section';
  section.id = id;

  const header = document.createElement('button');
  header.className = 'ws-section-header';
  header.textContent = label;
  header.addEventListener('click', () => section.classList.toggle('ws-section-collapsed'));

  const list = document.createElement('div');
  list.className = 'ws-section-list';

  section.appendChild(header);
  section.appendChild(list);
  return section;
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
    document.body.classList.toggle('ws-collapsed', collapsed);
  });
  sidebar.appendChild(toggleBtn);

  // Content wrapper
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

  // Navigation links
  const navSection = document.createElement('nav');
  navSection.className = 'ws-nav';
  for (const [href, label] of [['/entities.html', 'Entity Directory'], ['/kb.html', 'Knowledge Base']]) {
    const link = document.createElement('a');
    link.className = 'ws-nav-link';
    link.href = href;
    link.textContent = label;
    navSection.appendChild(link);
  }
  content.appendChild(navSection);

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
