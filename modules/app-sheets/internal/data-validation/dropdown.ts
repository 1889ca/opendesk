/** Contract: contracts/app-sheets/data-validation.md */
import type { ValidationRule } from './types.ts';

let activeDropdown: { el: HTMLElement; cleanup: () => void } | null = null;

export function showDropdown(
  anchor: HTMLElement,
  rule: ValidationRule,
  onSelect: (value: string) => void,
): void {
  closeDropdown();

  const items = rule.listItems || [];
  if (items.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'dv-dropdown';

  const list = document.createElement('ul');
  list.className = 'dv-dropdown-list';
  list.setAttribute('role', 'listbox');

  const currentValue = anchor.textContent?.trim() || '';
  let focusedIndex = -1;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const li = document.createElement('li');
    li.className = 'dv-dropdown-item';
    li.setAttribute('role', 'option');
    li.textContent = item;
    if (item.toLowerCase() === currentValue.toLowerCase()) {
      li.classList.add('dv-dropdown-item--selected');
      li.setAttribute('aria-selected', 'true');
    }
    li.addEventListener('click', () => {
      onSelect(item);
      closeDropdown();
    });
    list.appendChild(li);
  }

  overlay.appendChild(list);
  positionOverlay(overlay, anchor);
  document.body.appendChild(overlay);

  function onKeydown(e: KeyboardEvent) {
    const listItems = list.querySelectorAll<HTMLElement>('.dv-dropdown-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, listItems.length - 1);
      highlightItem(listItems, focusedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      highlightItem(listItems, focusedIndex);
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      onSelect(items[focusedIndex]);
      closeDropdown();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    }
  }

  function onClickOutside(e: MouseEvent) {
    if (!overlay.contains(e.target as Node)) {
      closeDropdown();
    }
  }

  document.addEventListener('keydown', onKeydown);
  setTimeout(() => document.addEventListener('click', onClickOutside), 0);

  activeDropdown = {
    el: overlay,
    cleanup() {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onClickOutside);
      overlay.remove();
    },
  };
}

export function closeDropdown(): void {
  if (activeDropdown) {
    activeDropdown.cleanup();
    activeDropdown = null;
  }
}

function positionOverlay(overlay: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  overlay.style.position = 'fixed';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.bottom + 'px';
  overlay.style.minWidth = rect.width + 'px';
  overlay.style.zIndex = '9999';
}

function highlightItem(items: NodeListOf<HTMLElement>, index: number): void {
  items.forEach((el, i) => {
    el.classList.toggle('dv-dropdown-item--focused', i === index);
  });
}
