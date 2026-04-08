/** Contract: contracts/app/shell.md */

/**
 * Dynamic import wrapper with loading states.
 * Loads editor modules on demand using ESM dynamic imports.
 */

export interface ViewModule {
  mount(container: HTMLElement, params: Record<string, string>): void | Promise<void>;
  unmount(): void;
}

type ModuleFactory = () => Promise<ViewModule>;

const moduleCache = new Map<string, ViewModule>();

/**
 * Load a view module by key. Uses a factory function for the dynamic import.
 * Caches the module after first load so subsequent navigations are instant.
 */
export async function loadModule(key: string, factory: ModuleFactory): Promise<ViewModule> {
  const cached = moduleCache.get(key);
  if (cached) return cached;

  const mod = await factory();
  moduleCache.set(key, mod);
  return mod;
}

/** Show a loading indicator in the given container. */
export function showLoading(container: HTMLElement): void {
  container.innerHTML = '';
  const loader = document.createElement('div');
  loader.className = 'shell-loading';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-label', 'Loading');

  const spinner = document.createElement('div');
  spinner.className = 'shell-loading-spinner';

  const text = document.createElement('span');
  text.className = 'shell-loading-text';
  text.textContent = 'Loading\u2026';

  loader.appendChild(spinner);
  loader.appendChild(text);
  container.appendChild(loader);
}

/** Clear loading indicator from the container. */
export function clearLoading(container: HTMLElement): void {
  const loader = container.querySelector('.shell-loading');
  if (loader) loader.remove();
}
