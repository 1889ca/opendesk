/** Contract: contracts/app/rules.md */
import { t, onLocaleChange } from '../i18n/index.ts';

/** Priority groups: lower number = higher priority (stays visible longer). */
const HIGH_PRIORITY_KEYS = new Set([
  'toolbar.bold', 'toolbar.italic', 'toolbar.strike', 'toolbar.code',
  'toolbar.heading1', 'toolbar.heading2', 'toolbar.heading3',
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

  // Measure available width
  const toolbarWidth = toolbar.clientWidth;
  const wrapperWidth = 48; // reserve space for the "..." button
  let usedWidth = 0;

  const children = Array.from(toolbar.children).filter(
    (el) => el !== wrapper && el instanceof HTMLElement,
  ) as HTMLElement[];

  const toOverflow: HTMLElement[] = [];
  let overflowing = false;

  for (const child of children) {
    if (overflowing) {
      toOverflow.push(child);
      continue;
    }
    usedWidth += child.offsetWidth + 4; // 4px gap
    if (usedWidth + wrapperWidth > toolbarWidth) {
      overflowing = true;
      const key = child.getAttribute('data-i18n-key');
      if (key && HIGH_PRIORITY_KEYS.has(key)) {
        continue;
      }
      toOverflow.push(child);
    }
  }

  if (toOverflow.length === 0) return;

  const sorted = sortByPriority(toOverflow);
  for (const el of sorted) {
    menu.appendChild(el);
  }

  wrapper.style.display = 'block';
}

function sortByPriority(elements: HTMLElement[]): HTMLElement[] {
  return elements.sort((a, b) => {
    const aKey = a.getAttribute('data-i18n-key') || '';
    const bKey = b.getAttribute('data-i18n-key') || '';
    const aPriority = HIGH_PRIORITY_KEYS.has(aKey) ? 0 : 1;
    const bPriority = HIGH_PRIORITY_KEYS.has(bKey) ? 0 : 1;
    return bPriority - aPriority; // low priority first
  });
}
