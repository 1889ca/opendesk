/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';
import { debounce } from './lifecycle.ts';

/** Keys that must always remain in the primary toolbar — never moved to overflow. */
const NEVER_OVERFLOW = new Set([
  'toolbar.undo', 'toolbar.redo',
  'toolbar.stylePicker', 'toolbar.fontSize',
  'toolbar.bold', 'toolbar.italic', 'toolbar.underline',
]);

/**
 * Sets up the More (···) overflow menu.
 *
 * alwaysOverflow items are pre-populated into the menu and NEVER restored
 * to the primary toolbar, regardless of available width. Dynamic overflow
 * of primary items (on narrow viewports) is layered on top.
 */
export function setupToolbarOverflow(
  toolbar: HTMLElement,
  alwaysOverflow: HTMLElement[] = [],
): () => void {
  const { wrapper, removeDocClickListener } = createOverflowWrapper(toolbar, alwaysOverflow);

  // Reflow on window resize (debounced) — NOT via ResizeObserver on the
  // toolbar. Observing the toolbar (or its parent) causes an infinite
  // oscillation: reflow moves children in/out → dimensions change →
  // observer fires → reflow again → every single frame, forever.
  const debouncedReflow = debounce(() => reflow(toolbar, wrapper), 100);
  window.addEventListener('resize', debouncedReflow.call);

  const unsubLocale = onLocaleChange(() => {
    requestAnimationFrame(() => reflow(toolbar, wrapper));
  });

  // Initial reflow after first paint
  requestAnimationFrame(() => reflow(toolbar, wrapper));

  return () => {
    window.removeEventListener('resize', debouncedReflow.call);
    debouncedReflow.cancel();
    removeDocClickListener();
    unsubLocale();
  };
}

function createOverflowWrapper(
  toolbar: HTMLElement,
  alwaysOverflow: HTMLElement[],
): { wrapper: HTMLElement; removeDocClickListener: () => void } {
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-overflow-wrapper';

  const trigger = document.createElement('button');
  trigger.className = 'toolbar-overflow-btn';
  trigger.setAttribute('aria-label', t('toolbar.moreOptions'));
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = '\u2026';

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';
  menu.setAttribute('role', 'menu');

  // Pre-populate with always-overflow items (never restored to primary toolbar)
  for (const el of alwaysOverflow) {
    el.dataset.alwaysOverflow = '1';
    // Separators are presentational, not interactive menu items
    el.setAttribute('role', el.classList.contains('toolbar-separator') ? 'separator' : 'menuitem');
    menu.appendChild(el);
  }
  // Always visible since there are permanent overflow items
  if (alwaysOverflow.length) wrapper.style.display = 'flex';

  function closeMenu(): void {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    clampMenu(menu, toolbar);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', opening);
    trigger.setAttribute('aria-expanded', String(opening));
    if (opening) {
      clampMenu(menu, toolbar);
      (menu.querySelector<HTMLElement>('[role="menuitem"]'))?.focus();
    }
  });

  trigger.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu(); trigger.focus(); return; }
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
  });

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  toolbar.appendChild(wrapper);

  const onDocClick = (e: MouseEvent) => {
    if (!wrapper.contains(e.target as Node)) closeMenu();
  };
  document.addEventListener('click', onDocClick);

  return { wrapper, removeDocClickListener: () => document.removeEventListener('click', onDocClick) };
}

function clampMenu(menu: HTMLElement, toolbar: HTMLElement): void {
  menu.style.right = '0';
  menu.style.left = '';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.right = `${r.right - window.innerWidth + 8}px`;
  const tr = toolbar.getBoundingClientRect();
  if (r.bottom > window.innerHeight) {
    menu.style.top = 'auto';
    menu.style.bottom = `${tr.height + 4}px`;
  } else {
    menu.style.top = '';
    menu.style.bottom = '';
  }
}

function reflow(toolbar: HTMLElement, wrapper: HTMLElement): void {
  const menu = wrapper.querySelector<HTMLElement>('.toolbar-overflow-menu');
  if (!menu) return;

  // Restore dynamic overflow items back to toolbar — skip always-overflow items
  for (const el of Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'))) {
    if (el.dataset.alwaysOverflow) continue;
    el.removeAttribute('role');
    toolbar.insertBefore(el, wrapper);
  }

  // Keep wrapper visible if there are always-overflow items; otherwise hide until needed
  const hasAlways = !!menu.querySelector('[data-always-overflow]');
  if (!hasAlways) wrapper.style.display = 'none';

  const WRAPPER_W = 48;
  const children = Array.from(toolbar.children).filter(
    (el) => el !== wrapper && el instanceof HTMLElement,
  ) as HTMLElement[];

  let total = children.reduce((s, el) => s + el.offsetWidth + 4, 0);
  if (total + WRAPPER_W <= toolbar.clientWidth) return;

  const toOverflow: HTMLElement[] = [];

  // Phase 1: low-priority items first (right-to-left, non-NEVER_OVERFLOW)
  for (const el of [...children].reverse()) {
    if (total + WRAPPER_W <= toolbar.clientWidth) break;
    if (!NEVER_OVERFLOW.has(el.getAttribute('data-i18n-key') ?? '')) {
      toOverflow.push(el);
      total -= el.offsetWidth + 4;
    }
  }

  if (!toOverflow.length) return;

  // Prepend dynamic overflow items before always-overflow items in menu
  const firstAlways = menu.querySelector<HTMLElement>('[data-always-overflow]');
  for (const el of toOverflow) {
    el.setAttribute('role', 'menuitem');
    menu.insertBefore(el, firstAlways);
  }
  wrapper.style.display = 'flex';
}
