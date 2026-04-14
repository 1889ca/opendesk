/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t } from '../i18n/index.ts';

/**
 * Build the heading picker dropdown button and its sub-menu.
 * Returns a wrapper element containing the "H" button and a dropdown
 * that positions itself above the bubble menu.
 */
export function buildHeadingPicker(
  editor: Editor,
  syncButtons: () => void,
): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'bubble-heading-wrapper';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bubble-menu-btn bubble-heading-btn';
  btn.innerHTML = '<span class="bubble-heading-label">H</span>';
  btn.setAttribute('aria-label', t('bubble.heading'));
  btn.setAttribute('title', t('bubble.heading'));
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  wrapper.appendChild(btn);

  const dropdown = document.createElement('div');
  dropdown.className = 'bubble-heading-picker';
  dropdown.setAttribute('role', 'menu');

  const options = [
    { label: () => t('bubble.headingNormal'), level: 0 },
    { label: () => 'H1', level: 1 },
    { label: () => 'H2', level: 2 },
    { label: () => 'H3', level: 3 },
  ];

  for (const opt of options) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bubble-heading-option';
    item.setAttribute('role', 'menuitem');
    item.textContent = opt.label();
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (opt.level === 0) {
        editor.chain().focus().setParagraph().run();
      } else {
        editor.chain().focus().toggleHeading({ level: opt.level as 1 | 2 | 3 }).run();
      }
      closeDropdown();
      syncButtons();
    });
    dropdown.appendChild(item);
  }
  wrapper.appendChild(dropdown);

  function closeDropdown(): void {
    dropdown.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const isOpen = dropdown.classList.contains('is-open');
    if (isOpen) {
      closeDropdown();
    } else {
      dropdown.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  // Close on click outside
  document.addEventListener('mousedown', (e) => {
    if (!wrapper.contains(e.target as Node)) closeDropdown();
  });

  return wrapper;
}
