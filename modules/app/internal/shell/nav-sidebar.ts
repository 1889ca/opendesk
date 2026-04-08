/** Contract: contracts/app/shell.md */

import { navigate } from './router.ts';
import { t, onLocaleChange, type TranslationKey } from '../i18n/index.ts';
import { apiFetch } from '../shared/api-client.ts';

interface RecentDoc {
  id: string;
  title: string;
}

let sidebarEl: HTMLElement | null = null;
let recentListEl: HTMLElement | null = null;

/** Build the navigation sidebar. Returns the root element. */
export function buildNavSidebar(): HTMLElement {
  sidebarEl = document.createElement('nav');
  sidebarEl.className = 'shell-sidebar';
  sidebarEl.setAttribute('aria-label', 'Main navigation');

  const logo = document.createElement('a');
  logo.className = 'shell-sidebar-logo';
  logo.href = '/';
  logo.textContent = 'OpenDesk';

  const navList = document.createElement('ul');
  navList.className = 'shell-sidebar-nav';

  const dashItem = createNavItem('/', 'nav.dashboard', '\u{1F4C4}');
  navList.appendChild(dashItem);

  const newDocItem = document.createElement('li');
  const newDocBtn = document.createElement('button');
  newDocBtn.className = 'shell-sidebar-btn shell-sidebar-new';
  newDocBtn.textContent = t('nav.newDocument');
  newDocBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('opendesk:create-document'));
  });
  onLocaleChange(() => { newDocBtn.textContent = t('nav.newDocument'); });
  newDocItem.appendChild(newDocBtn);
  navList.appendChild(newDocItem);

  const recentHeading = document.createElement('h3');
  recentHeading.className = 'shell-sidebar-heading';
  recentHeading.textContent = t('nav.recent');
  onLocaleChange(() => { recentHeading.textContent = t('nav.recent'); });

  recentListEl = document.createElement('ul');
  recentListEl.className = 'shell-sidebar-recent';

  sidebarEl.appendChild(logo);
  sidebarEl.appendChild(navList);
  sidebarEl.appendChild(recentHeading);
  sidebarEl.appendChild(recentListEl);

  loadRecentDocs();

  return sidebarEl;
}

function createNavItem(href: string, i18nKey: TranslationKey, icon: string): HTMLElement {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.href = href;
  link.className = 'shell-sidebar-link';
  link.innerHTML = `<span class="shell-sidebar-icon">${icon}</span> <span class="shell-sidebar-label">${t(i18nKey)}</span>`;
  onLocaleChange(() => {
    const label = link.querySelector('.shell-sidebar-label');
    if (label) label.textContent = t(i18nKey);
  });
  li.appendChild(link);
  return li;
}

/** Update active state in the sidebar based on current path. */
export function updateActiveRoute(path: string): void {
  if (!sidebarEl) return;
  const links = sidebarEl.querySelectorAll('.shell-sidebar-link');
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isActive = path === href || (href !== '/' && path.startsWith(href));
    link.classList.toggle('active', isActive);
  });
}

/** Refresh the recent documents list. */
export async function loadRecentDocs(): Promise<void> {
  if (!recentListEl) return;
  try {
    const res = await apiFetch('/api/documents');
    if (!res.ok) return;
    const docs: RecentDoc[] = await res.json();
    renderRecentDocs(docs.slice(0, 5));
  } catch {
    // Silently fail — recent list is not critical
  }
}

function renderRecentDocs(docs: RecentDoc[]): void {
  if (!recentListEl) return;
  recentListEl.innerHTML = '';
  for (const doc of docs) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/doc/${encodeURIComponent(doc.id)}`;
    link.className = 'shell-sidebar-recent-link';
    link.textContent = doc.title || 'Untitled';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(`/doc/${encodeURIComponent(doc.id)}`);
    });
    li.appendChild(link);
    recentListEl.appendChild(li);
  }
}

/** Toggle sidebar collapsed state. */
export function toggleSidebar(): void {
  if (sidebarEl) {
    sidebarEl.classList.toggle('collapsed');
  }
}
