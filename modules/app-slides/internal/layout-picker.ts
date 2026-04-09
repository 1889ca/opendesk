/** Contract: contracts/app-slides/rules.md */

import { LAYOUT_TYPES, LAYOUT_LABELS, getLayoutPlaceholders, type LayoutType } from './layouts.ts';

type LayoutSelectCallback = (layout: LayoutType) => void;

/** Create a layout picker dropdown attached to the "Add Slide" button. */
export function createLayoutPicker(onSelect: LayoutSelectCallback): {
  element: HTMLElement;
  destroy: () => void;
} {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-layout-picker';

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary btn-sm slide-layout-picker__btn';
  btn.textContent = '+ Add Slide';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'slide-layout-picker__menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  for (const layout of LAYOUT_TYPES) {
    const item = document.createElement('button');
    item.className = 'slide-layout-picker__item';
    item.setAttribute('role', 'menuitem');

    const preview = buildLayoutPreview(layout);
    const label = document.createElement('span');
    label.className = 'slide-layout-picker__label';
    label.textContent = LAYOUT_LABELS[layout];

    item.appendChild(preview);
    item.appendChild(label);
    item.addEventListener('click', () => {
      onSelect(layout);
      close();
    });
    menu.appendChild(item);
  }

  function toggle() {
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  function close() {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  function handleOutsideClick(e: MouseEvent) {
    if (!wrapper.contains(e.target as Node)) close();
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);

  return {
    element: wrapper,
    destroy() {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      wrapper.remove();
    },
  };
}

/** Build a tiny layout thumbnail preview (16:9 ratio mini-boxes). */
function buildLayoutPreview(layout: LayoutType): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'slide-layout-preview';

  const placeholders = getLayoutPlaceholders(layout);
  for (const p of placeholders) {
    const box = document.createElement('div');
    box.className = 'slide-layout-preview__placeholder';
    box.style.left = `${p.x}%`;
    box.style.top = `${p.y}%`;
    box.style.width = `${p.width}%`;
    box.style.height = `${p.height}%`;
    preview.appendChild(box);
  }

  return preview;
}
