/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';

/** Keys that must always remain visible — never pushed to the overflow menu. */
const NEVER_OVERFLOW = new Set([
  'toolbar.undo', 'toolbar.redo',
  'toolbar.stylePicker', 'toolbar.fontSize',
  'toolbar.bold', 'toolbar.italic', 'toolbar.underline',
]);

/** Keys that overflow first when space is tight. */
const LOW_PRIORITY = new Set([
  'toolbar.print', 'toolbar.pdf',
  'toolbar.references', 'toolbar.versions', 'toolbar.workflows',
  'toolbar.saveToKb',
]);

/**
 * Detects available toolbar width via ResizeObserver and moves
 * buttons that don't fit into an overflow dropdown (⋯ menu).
 */
export function setupToolbarOverflow(toolbar: HTMLElement): () => void {
  const { wrapper, removeDocClickListener } = createOverflowWrapper(toolbar);
  const observer = new ResizeObserver(() => reflow(toolbar, wrapper));
  observer.observe(toolbar);
  const unsubLocale = onLocaleChange(() => {
    requestAnimationFrame(() => reflow(toolbar, wrapper));
  });
  return () => { observer.disconnect(); removeDocClickListener(); unsubLocale(); };
}

function createOverflowWrapper(toolbar: HTMLElement): {
  wrapper: HTMLElement; removeDocClickListener: () => void;
} {
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
  menu.hidden = true;

  function closeMenu(): void {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    clampMenu(menu, toolbar);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
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

  // Restore all overflow items back to toolbar
  for (const el of Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'))) {
    el.removeAttribute('role');
    toolbar.insertBefore(el, wrapper);
  }
  wrapper.style.display = 'none';
  menu.hidden = true;
  wrapper.querySelector('button')?.setAttribute('aria-expanded', 'false');

  const WRAPPER_W = 48;
  const children = Array.from(toolbar.children).filter(
    (el) => el !== wrapper && el instanceof HTMLElement,
  ) as HTMLElement[];

  let total = children.reduce((s, el) => s + el.offsetWidth + 4, 0);
  if (total + WRAPPER_W <= toolbar.clientWidth) return;

  const toOverflow: HTMLElement[] = [];

  // Phase 1: low-priority items first
  for (const el of children) {
    if (total + WRAPPER_W <= toolbar.clientWidth) break;
    if (LOW_PRIORITY.has(el.getAttribute('data-i18n-key') ?? '')) {
      toOverflow.push(el);
      total -= el.offsetWidth + 4;
    }
  }

  // Phase 2: neutral items right-to-left
  if (total + WRAPPER_W > toolbar.clientWidth) {
    for (const el of [...children].reverse()) {
      if (total + WRAPPER_W <= toolbar.clientWidth) break;
      if (!toOverflow.includes(el) && score(el) === 1) {
        toOverflow.push(el);
        total -= el.offsetWidth + 4;
      }
    }
  }

  // Phase 3: last resort — anything that isn't NEVER_OVERFLOW
  if (total + WRAPPER_W > toolbar.clientWidth) {
    for (const el of [...children].reverse()) {
      if (total + WRAPPER_W <= toolbar.clientWidth) break;
      if (!toOverflow.includes(el) && !NEVER_OVERFLOW.has(el.getAttribute('data-i18n-key') ?? '')) {
        toOverflow.push(el);
        total -= el.offsetWidth + 4;
      }
    }
  }

  if (!toOverflow.length) return;

  for (const el of sortByScore(toOverflow)) {
    el.setAttribute('role', 'menuitem');
    menu.appendChild(el);
  }
  wrapper.style.display = 'block';
}

function score(el: HTMLElement): number {
  const k = el.getAttribute('data-i18n-key') ?? '';
  if (NEVER_OVERFLOW.has(k)) return -1;
  if (LOW_PRIORITY.has(k)) return 2;
  return 1;
}

function sortByScore(els: HTMLElement[]): HTMLElement[] {
  return els.sort((a, b) => score(b) - score(a));
}
