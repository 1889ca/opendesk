/** Contract: contracts/app/shell.md */

import { registerRoutes, startRouter, setNavigateCallback, type Route } from './router.ts';
import { loadModule, showLoading, clearLoading, type ViewModule } from './lazy-loader.ts';
import { buildNavSidebar, updateActiveRoute, loadRecentDocs } from './nav-sidebar.ts';
import { resolveLocale, setLocale, persistLocale, onLocaleChange } from '../i18n/index.ts';
import { initTheme } from '../shared/theme-toggle.ts';

let contentEl: HTMLElement | null = null;
let currentView: ViewModule | null = null;
let currentViewKey: string | null = null;

/** Build the app shell DOM structure. */
function buildShellDOM(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const sidebar = buildNavSidebar();

  const main = document.createElement('main');
  main.className = 'shell-content';
  main.id = 'shell-content';
  main.setAttribute('role', 'main');

  app.appendChild(sidebar);
  app.appendChild(main);
  contentEl = main;
}

/** Unmount the current view cleanly. */
async function unmountCurrent(): Promise<void> {
  if (currentView) {
    currentView.unmount();
    currentView = null;
    currentViewKey = null;
  }
  if (contentEl) {
    contentEl.innerHTML = '';
  }
}

/** Mount a view module into the content area. */
async function mountView(key: string, factory: () => Promise<ViewModule>, params: Record<string, string>): Promise<void> {
  // Skip if already on the same view with same params
  if (currentViewKey === key && currentView) {
    return;
  }

  await unmountCurrent();

  if (!contentEl) return;
  showLoading(contentEl);

  try {
    const mod = await loadModule(key, factory);
    clearLoading(contentEl);
    currentView = mod;
    currentViewKey = key;
    await mod.mount(contentEl, params);
  } catch (err) {
    clearLoading(contentEl);
    if (contentEl) {
      contentEl.innerHTML = '<div class="shell-error">Failed to load view. Please try again.</div>';
    }
    console.error('[shell] Failed to mount view:', key, err);
  }
}

/** Define all application routes. */
function defineRoutes(): Route[] {
  return [
    {
      pattern: '/',
      handler: () => mountView('dashboard', () => import('../views/dashboard-view.ts'), {}),
    },
    {
      pattern: '/doc/:id',
      handler: (params) => mountView(
        `doc:${params.id}`,
        () => import('../views/editor-view.ts'),
        params,
      ),
    },
    {
      pattern: '/sheet/:id',
      handler: (params) => mountView(
        `sheet:${params.id}`,
        () => import('../views/placeholder-view.ts'),
        { ...params, type: 'spreadsheet' },
      ),
    },
    {
      pattern: '/slides/:id',
      handler: (params) => mountView(
        `slides:${params.id}`,
        () => import('../views/placeholder-view.ts'),
        { ...params, type: 'presentation' },
      ),
    },
  ];
}

/** Initialize the app shell. */
export function initShell(): void {
  // Resolve locale
  const locale = resolveLocale();
  setLocale(locale);
  persistLocale(locale);
  document.documentElement.lang = locale;
  onLocaleChange(() => {
    document.documentElement.lang = locale;
  });

  // Init theme
  initTheme();

  // Build shell DOM
  buildShellDOM();

  // Set up routing
  const routes = defineRoutes();
  registerRoutes(routes);

  setNavigateCallback((path) => {
    updateActiveRoute(path);
    // Refresh recent docs when navigating to dashboard
    if (path === '/') loadRecentDocs();
  });

  // Start router — resolves initial route
  startRouter();
}
