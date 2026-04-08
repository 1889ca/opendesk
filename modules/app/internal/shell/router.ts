/** Contract: contracts/app/shell.md */

/**
 * Lightweight client-side router using pushState.
 * No framework dependencies — vanilla TypeScript.
 */

export interface Route {
  /** Pattern like '/doc/:id' — :segments are params */
  pattern: string;
  /** Handler called when route matches */
  handler: (params: Record<string, string>) => void | Promise<void>;
}

export interface MatchResult {
  route: Route;
  params: Record<string, string>;
}

/** Parse a route pattern into regex + param names. */
function compilePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = pattern
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regexStr}/?$`), paramNames };
}

/** Match a path against a list of routes. Returns first match or null. */
export function matchRoute(path: string, routes: Route[]): MatchResult | null {
  const cleanPath = path.split('?')[0].split('#')[0];
  for (const route of routes) {
    const { regex, paramNames } = compilePattern(route.pattern);
    const match = cleanPath.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { route, params };
    }
  }
  return null;
}

export type NavigateCallback = (path: string) => void;

let routes: Route[] = [];
let onNavigate: NavigateCallback | null = null;

/** Register routes for the router. */
export function registerRoutes(newRoutes: Route[]): void {
  routes = newRoutes;
}

/** Set a callback that fires on every navigation (for shell to react). */
export function setNavigateCallback(cb: NavigateCallback): void {
  onNavigate = cb;
}

/** Navigate to a path using pushState. */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  handleRoute(path);
}

/** Resolve the current location and call the matching route handler. */
function handleRoute(path: string): void {
  if (onNavigate) onNavigate(path);
  const result = matchRoute(path, routes);
  if (result) {
    result.route.handler(result.params);
  }
}

/** Handle popstate (back/forward buttons). */
function onPopState(): void {
  handleRoute(location.pathname);
}

/**
 * Intercept clicks on internal <a> links to use client-side routing.
 * Only intercepts same-origin links without target, download, or modifier keys.
 */
function onLinkClick(e: MouseEvent): void {
  if (e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (e.button !== 0) return;

  const anchor = (e.target as Element).closest('a');
  if (!anchor) return;
  if (anchor.target && anchor.target !== '_self') return;
  if (anchor.hasAttribute('download')) return;
  if (anchor.getAttribute('rel')?.includes('external')) return;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return;

  // Skip API and static asset paths
  if (href.startsWith('/api/') || href.endsWith('.css') || href.endsWith('.js')) return;

  e.preventDefault();
  navigate(href);
}

/** Start the router: listen for popstate and link clicks, resolve initial route. */
export function startRouter(): void {
  window.addEventListener('popstate', onPopState);
  document.addEventListener('click', onLinkClick);
  handleRoute(location.pathname);
}

/** Stop the router: remove event listeners. */
export function stopRouter(): void {
  window.removeEventListener('popstate', onPopState);
  document.removeEventListener('click', onLinkClick);
}
