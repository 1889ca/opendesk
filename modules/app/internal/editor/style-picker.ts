/** Contract: contracts/app/rules.md */
/**
 * Custom paragraph/heading style picker dropdown.
 * Replaces the native <select> with a keyboard-accessible listbox popup.
 */
import type { Editor } from '@tiptap/core';

interface StyleOption {
  label: string;
  command: (e: Editor) => void;
  style?: string;
  isActive: (e: Editor) => boolean;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    label: 'Normal',
    command: (e) => e.chain().focus().setParagraph().run(),
    isActive: (e) => !e.isActive('heading') && !e.isActive('codeBlock') && !e.isActive('blockquote'),
  },
  {
    label: 'Heading 1',
    command: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
    style: 'font-size:1.5em;font-weight:700',
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    label: 'Heading 2',
    command: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
    style: 'font-size:1.25em;font-weight:700',
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    label: 'Heading 3',
    command: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
    style: 'font-size:1.1em;font-weight:600',
    isActive: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    label: 'Heading 4',
    command: (e) => e.chain().focus().setHeading({ level: 4 }).run(),
    style: 'font-weight:600',
    isActive: (e) => e.isActive('heading', { level: 4 }),
  },
  {
    label: 'Heading 5',
    command: (e) => e.chain().focus().setHeading({ level: 5 }).run(),
    style: 'font-size:0.9em;font-weight:600',
    isActive: (e) => e.isActive('heading', { level: 5 }),
  },
  {
    label: 'Heading 6',
    command: (e) => e.chain().focus().setHeading({ level: 6 }).run(),
    style: 'font-size:0.85em;font-weight:600;color:var(--text-muted)',
    isActive: (e) => e.isActive('heading', { level: 6 }),
  },
  {
    label: 'Code',
    command: (e) => e.chain().focus().setCodeBlock().run(),
    style: 'font-family:monospace;font-size:0.85em',
    isActive: (e) => e.isActive('codeBlock'),
  },
  {
    label: 'Quote',
    command: (e) => e.chain().focus().setBlockquote().run(),
    style: 'border-left:3px solid var(--border);padding-left:0.5em;color:var(--text-muted)',
    isActive: (e) => e.isActive('blockquote'),
  },
];

function getActiveLabel(editor: Editor): string {
  return STYLE_OPTIONS.find((o) => o.isActive(editor))?.label ?? 'Normal';
}

export function buildStylePicker(editor: Editor): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'style-picker';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'style-picker-btn toolbar-select toolbar-select--style';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Paragraph style');
  btn.setAttribute('title', 'Paragraph style');
  btn.textContent = getActiveLabel(editor);

  const menu = document.createElement('ul');
  menu.className = 'style-picker-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Paragraph style');
  menu.hidden = true;

  let focusedIndex = -1;

  const optionEls: HTMLLIElement[] = STYLE_OPTIONS.map((opt, i) => {
    const li = document.createElement('li');
    li.className = 'style-picker-option';
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.setAttribute('tabindex', '-1');
    li.setAttribute('data-index', String(i));
    if (opt.style) li.setAttribute('style', opt.style);
    li.textContent = opt.label;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyOption(i);
    });
    menu.appendChild(li);
    return li;
  });

  function syncActive(): void {
    const label = getActiveLabel(editor);
    btn.textContent = label;
    optionEls.forEach((el, i) => {
      const active = STYLE_OPTIONS[i].isActive(editor);
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', String(active));
    });
  }

  function openMenu(): void {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    focusedIndex = STYLE_OPTIONS.findIndex((o) => o.isActive(editor));
    if (focusedIndex < 0) focusedIndex = 0;
    moveFocus(focusedIndex);
  }

  function closeMenu(): void {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    focusedIndex = -1;
  }

  function moveFocus(index: number): void {
    optionEls[focusedIndex]?.classList.remove('is-focused');
    focusedIndex = Math.max(0, Math.min(index, optionEls.length - 1));
    const el = optionEls[focusedIndex];
    el.classList.add('is-focused');
    el.focus();
  }

  function applyOption(index: number): void {
    STYLE_OPTIONS[index].command(editor);
    closeMenu();
    btn.focus();
    syncActive();
  }

  btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
  btn.addEventListener('click', () => {
    if (menu.hidden) { openMenu(); } else { closeMenu(); }
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu();
    }
  });

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); btn.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(focusedIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(focusedIndex - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyOption(focusedIndex); }
    else if (e.key === 'Home') { e.preventDefault(); moveFocus(0); }
    else if (e.key === 'End') { e.preventDefault(); moveFocus(optionEls.length - 1); }
  });

  document.addEventListener('mousedown', (e) => {
    if (!wrapper.contains(e.target as Node)) closeMenu();
  });

  editor.on('selectionUpdate', syncActive);
  editor.on('transaction', syncActive);
  syncActive();

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}
