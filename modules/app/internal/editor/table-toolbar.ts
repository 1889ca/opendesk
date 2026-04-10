/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange, type TranslationKey } from '../i18n/index.ts';
import { buildCellFormatSection } from './table-cell-format.ts';

interface TableButton {
  key: TranslationKey;
  action: (editor: Editor) => void;
  canRun?: (editor: Editor) => boolean;
}

const TABLE_BUTTONS: TableButton[] = [
  {
    key: 'table.addRowBefore',
    action: (e) => e.chain().focus().addRowBefore().run(),
  },
  {
    key: 'table.addRowAfter',
    action: (e) => e.chain().focus().addRowAfter().run(),
  },
  {
    key: 'table.deleteRow',
    action: (e) => e.chain().focus().deleteRow().run(),
  },
  {
    key: 'table.addColumnBefore',
    action: (e) => e.chain().focus().addColumnBefore().run(),
  },
  {
    key: 'table.addColumnAfter',
    action: (e) => e.chain().focus().addColumnAfter().run(),
  },
  {
    key: 'table.deleteColumn',
    action: (e) => e.chain().focus().deleteColumn().run(),
  },
  {
    key: 'table.mergeCells',
    action: (e) => e.chain().focus().mergeCells().run(),
    canRun: (e) => e.can().mergeCells(),
  },
  {
    key: 'table.splitCell',
    action: (e) => e.chain().focus().splitCell().run(),
    canRun: (e) => e.can().splitCell(),
  },
  {
    key: 'table.toggleHeaderRow',
    action: (e) => e.chain().focus().toggleHeaderRow().run(),
  },
  {
    key: 'table.toggleHeaderColumn',
    action: (e) => e.chain().focus().toggleHeaderColumn().run(),
  },
  {
    key: 'table.deleteTable',
    action: (e) => e.chain().focus().deleteTable().run(),
  },
];

function renderTableToolbar(container: HTMLElement, editor: Editor) {
  container.innerHTML = '';
  for (const { key, action, canRun } of TABLE_BUTTONS) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn table-toolbar-btn';
    btn.textContent = t(key);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      action(editor);
    });

    if (canRun) {
      const updateDisabled = () => {
        btn.disabled = !canRun(editor);
      };
      editor.on('selectionUpdate', updateDisabled);
      editor.on('transaction', updateDisabled);
      updateDisabled();
    }

    container.appendChild(btn);
  }

  buildCellFormatSection(container, editor);
}

/**
 * Build and manage the contextual table toolbar.
 * Shows/hides automatically based on cursor position.
 */
export function buildTableToolbar(editor: Editor): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Table editing');

  const formattingToolbar = document.getElementById('formatting-toolbar');
  if (formattingToolbar?.parentElement) {
    formattingToolbar.parentElement.insertBefore(
      toolbar,
      formattingToolbar.nextSibling,
    );
  }

  const render = () => renderTableToolbar(toolbar, editor);
  render();
  onLocaleChange(render);

  const updateVisibility = () => {
    const inTable = editor.isActive('table');
    toolbar.style.display = inTable ? 'flex' : 'none';
  };

  editor.on('selectionUpdate', updateVisibility);
  editor.on('transaction', updateVisibility);
  updateVisibility();
}
