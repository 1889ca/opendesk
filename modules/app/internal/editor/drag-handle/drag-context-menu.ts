/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t } from '../../i18n/index.ts';

interface MenuState {
  menuEl: HTMLElement | null;
  onDocClick: ((e: MouseEvent) => void) | null;
  onDocKeydown: ((e: KeyboardEvent) => void) | null;
}

const state: MenuState = { menuEl: null, onDocClick: null, onDocKeydown: null };

export function closeMenu(): void {
  if (state.menuEl) {
    state.menuEl.remove();
    state.menuEl = null;
  }
  if (state.onDocClick) {
    document.removeEventListener('mousedown', state.onDocClick);
    state.onDocClick = null;
  }
  if (state.onDocKeydown) {
    document.removeEventListener('keydown', state.onDocKeydown);
    state.onDocKeydown = null;
  }
}

function cutBlock(editor: Editor, pos: number): void {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const text = node.textContent;
  navigator.clipboard?.writeText(text).catch(() => undefined);
  const { tr } = editor.state;
  editor.view.dispatch(tr.delete(pos, pos + node.nodeSize));
}

function duplicateBlock(editor: Editor, pos: number): void {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const { tr } = editor.state;
  tr.insert(pos + node.nodeSize, node);
  editor.view.dispatch(tr);
}

function deleteBlock(editor: Editor, pos: number): void {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  const { tr } = editor.state;
  editor.view.dispatch(tr.delete(pos, pos + node.nodeSize));
}

function makeItem(label: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'drag-context-menu__item';
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
    onClick();
  });
  return btn;
}

export function openContextMenu(
  editor: Editor,
  pos: number,
  anchorEl: HTMLElement,
): void {
  closeMenu();

  const menu = document.createElement('div');
  menu.className = 'drag-context-menu';
  menu.setAttribute('role', 'menu');

  menu.appendChild(makeItem(t('dragHandle.cut'),       () => cutBlock(editor, pos)));
  menu.appendChild(makeItem(t('dragHandle.duplicate'), () => duplicateBlock(editor, pos)));
  menu.appendChild(makeItem(t('dragHandle.delete'),    () => deleteBlock(editor, pos)));

  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.top}px`;
  menu.style.left = `${rect.right + 4}px`;

  document.body.appendChild(menu);
  state.menuEl = menu;

  // Keep menu in viewport horizontally
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth - 8) {
    menu.style.left = `${rect.left - menuRect.width - 4}px`;
  }

  state.onDocClick = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) closeMenu();
  };
  state.onDocKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMenu();
  };

  document.addEventListener('mousedown', state.onDocClick);
  document.addEventListener('keydown', state.onDocKeydown);
}
