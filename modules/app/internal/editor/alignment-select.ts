/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { batchRaf } from './lifecycle.ts';
import { getIcon } from './toolbar-icons.ts';

type Alignment = 'left' | 'center' | 'right' | 'justify';

const ALIGNMENTS: { value: Alignment; label: string; icon: string }[] = [
  { value: 'left', label: 'Left', icon: 'alignLeft' },
  { value: 'center', label: 'Center', icon: 'alignCenter' },
  { value: 'right', label: 'Right', icon: 'alignRight' },
  { value: 'justify', label: 'Justify', icon: 'alignJustify' },
];

export function buildAlignmentDropdown(editor: Editor): { el: HTMLElement; cleanup: () => void } {
  const wrapper = document.createElement('div');
  wrapper.className = 'alignment-dropdown';

  const trigger = document.createElement('button');
  trigger.className = 'toolbar-btn toolbar-btn--icon';
  trigger.setAttribute('aria-label', 'Text alignment');
  trigger.setAttribute('title', 'Text alignment');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = getIcon('alignLeft');

  const menu = document.createElement('div');
  menu.className = 'alignment-dropdown-menu';
  menu.setAttribute('role', 'menu');

  for (const a of ALIGNMENTS) {
    const item = document.createElement('button');
    item.className = 'alignment-dropdown-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('data-align', a.value);
    item.innerHTML = getIcon(a.icon) + `<span>${a.label}</span>`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      editor.chain().focus().setTextAlign(a.value).run();
      close();
    });
    menu.appendChild(item);
  }

  function open(): void {
    menu.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('is-open') ? close() : open();
  });

  const onDocClick = () => close();
  document.addEventListener('click', onDocClick);

  const updateIcon = () => {
    for (const a of ALIGNMENTS) {
      if (editor.isActive({ textAlign: a.value })) {
        trigger.innerHTML = getIcon(a.icon);
        return;
      }
    }
    trigger.innerHTML = getIcon('alignLeft');
  };

  const batched = batchRaf(updateIcon);
  editor.on('selectionUpdate', batched.call);
  editor.on('transaction', batched.call);

  wrapper.append(trigger, menu);

  const cleanup = () => {
    batched.cancel();
    editor.off('selectionUpdate', batched.call);
    editor.off('transaction', batched.call);
    document.removeEventListener('click', onDocClick);
  };

  return { el: wrapper, cleanup };
}
