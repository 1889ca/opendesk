/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { t } from '../i18n/index.ts';

interface BubbleAction {
  label: () => string;
  isActive: () => boolean;
  run: () => void;
}

function promptLink(): string | null {
  return prompt(t('bubble.linkPrompt'));
}

function buildActions(editor: Editor): BubbleAction[] {
  return [
    {
      label: () => t('bubble.bold'),
      isActive: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: () => t('bubble.italic'),
      isActive: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: () => t('bubble.underline'),
      isActive: () => editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: () => t('bubble.link'),
      isActive: () => editor.isActive('link'),
      run: () => {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();
        } else {
          const url = promptLink();
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }
      },
    },
  ];
}

/**
 * Create a floating bubble menu that appears on text selection.
 * Registers itself as a ProseMirror plugin on the given editor.
 */
export function buildBubbleMenu(editor: Editor): void {
  const menu = document.createElement('div');
  menu.className = 'bubble-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', t('a11y.formattingToolbar'));
  document.body.appendChild(menu);

  const actions = buildActions(editor);
  const buttons: HTMLButtonElement[] = [];

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bubble-menu-btn';
    btn.textContent = action.label();
    btn.setAttribute('aria-label', action.label());
    btn.addEventListener('mousedown', (e) => {
      // prevent editor losing focus before the click fires
      e.preventDefault();
      action.run();
      syncButtons();
    });
    menu.appendChild(btn);
    buttons.push(btn);
  }

  function syncButtons(): void {
    actions.forEach((action, i) => {
      const active = action.isActive();
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-pressed', String(active));
    });
  }

  editor.on('selectionUpdate', syncButtons);
  editor.on('transaction', syncButtons);

  editor.registerPlugin(
    BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element: menu,
    }),
  );
}
