/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';

/** Priority groups: lower number = higher priority (stays visible longer). */
const HIGH_PRIORITY_KEYS = new Set([
  // Core text formatting
  'toolbar.undo', 'toolbar.redo',
  'toolbar.bold', 'toolbar.italic', 'toolbar.strike', 'toolbar.code',
  'toolbar.heading1', 'toolbar.heading2', 'toolbar.heading3',
  // Alignment
  'toolbar.alignLeft', 'toolbar.alignCenter', 'toolbar.alignRight', 'toolbar.alignJustify',
  // Lists
  'toolbar.bulletList', 'toolbar.orderedList',
]);

/** Low-priority keys pushed to overflow first when space is limited. */
const LOW_PRIORITY_KEYS = new Set([
  'toolbar.print', 'toolbar.pdf',
  'toolbar.references', 'toolbar.versions', 'toolbar.workflows',
  'toolbar.saveToKb',
]);

/**
 * Detects available toolbar width via ResizeObserver and moves
 * buttons that don't fit into an overflow dropdown.
 */
export function setupToolbarOverflow(toolbar: HTMLElement): () => void {
  const { wrapper, removeDocClickListener } = createOverflowWrapper(toolbar);
  const observer = new ResizeObserver(() => reflow(toolbar, wrapper));
  observer.observe(toolbar);

  const unsubLocale = onLocaleChange(() => {
    requestAnimationFrame(() => reflow(toolbar, wrapper));
  });

  return () => {
    observer.disconnect();
    removeDocClickListener();
    unsubLocale();
  };
}

function createOverflowWrapper(
  toolbar: HTMLElement,
): { wrapper: HTMLElement; removeDocClickListener: () => void } {
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-overflow-wrapper';

  const trigger = document.createElement('button');
  trigger.className = 'toolbar-overflow-btn';
  trigger.setAttribute('aria-label', t('toolbar.moreOptions'));
  trigger.textContent = '\u2026'; // ellipsis
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('is-open');
  });

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  toolbar.appendChild(wrapper);

  // Close menu on outside click
  const onDocClick = () => menu.classList.remove('is-open');
  document.addEventListener('click', onDocClick);

  return {
    wrapper,
    removeDocClickListener: () => document.removeEventListener('click', onDocClick),
  };
}

function reflow(toolbar: HTMLElement, wrapper: HTMLElement): void {
  const menu = wrapper.querySelector('.toolbar-overflow-menu');
  if (!menu) return;

  // Reset: move all overflow items back to toolbar
  const overflowed = Array.from(
    menu.querySelectorAll('.toolbar-btn, .toolbar-separator'),
  );
  for (const el of overflowed) {
    toolbar.insertBefore(el, wrapper);
  }
  wrapper.style.display = 'none';

  const toolbarWidth = toolbar.clientWidth;
  const wrapperWidth = 48; // reserve space for the "…" button

  const children = Array.from(toolbar.children).filter(
    (el) => el !== wrapper && el instanceof HTMLElement,
  ) as HTMLElement[];

  let totalWidth = children.reduce((sum, el) => sum + el.offsetWidth + 4, 0);
  if (totalWidth + wrapperWidth <= toolbarWidth) return;

  const toOverflow: HTMLElement[] = [];

  // Phase 1: overflow low-priority items first (print, pdf, versions, etc.)
  for (const el of children) {
    if (totalWidth + wrapperWidth <= toolbarWidth) break;
    const key = el.getAttribute('data-i18n-key') || '';
    if (LOW_PRIORITY_KEYS.has(key)) {
      toOverflow.push(el);
      totalWidth -= el.offsetWidth + 4;
    }
  }

  // Phase 2: overflow neutral items from right to left
  if (totalWidth + wrapperWidth > toolbarWidth) {
    const neutral = [...children].reverse().filter(
      (el) => !toOverflow.includes(el) && priorityScore(el.getAttribute('data-i18n-key') || '') === 1,
    );
    for (const el of neutral) {
      if (totalWidth + wrapperWidth <= toolbarWidth) break;
      toOverflow.push(el);
      totalWidth -= el.offsetWidth + 4;
    }
  }

  // Phase 3: overflow high-priority items from right to left (last resort)
  if (totalWidth + wrapperWidth > toolbarWidth) {
    const high = [...children].reverse().filter(
      (el) => !toOverflow.includes(el) && HIGH_PRIORITY_KEYS.has(el.getAttribute('data-i18n-key') || ''),
    );
    for (const el of high) {
      if (totalWidth + wrapperWidth <= toolbarWidth) break;
      toOverflow.push(el);
      totalWidth -= el.offsetWidth + 4;
    }
  }

  if (toOverflow.length === 0) return;

  for (const el of sortByPriority([...toOverflow])) {
    menu.appendChild(el);
  }
  wrapper.style.display = 'block';
}

function priorityScore(key: string): number {
  if (LOW_PRIORITY_KEYS.has(key)) return 2;   // overflow first
  if (HIGH_PRIORITY_KEYS.has(key)) return 0;  // overflow last
  return 1;                                    // neutral
}

function sortByPriority(elements: HTMLElement[]): HTMLElement[] {
  return elements.sort((a, b) => {
    const aScore = priorityScore(a.getAttribute('data-i18n-key') || '');
    const bScore = priorityScore(b.getAttribute('data-i18n-key') || '');
    return bScore - aScore; // highest score overflows first
  });
}
