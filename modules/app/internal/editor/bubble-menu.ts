/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { t } from '../i18n/index.ts';
import { getIcon } from './toolbar-icons.ts';
import { showLinkPopover } from './link-popover.ts';

interface BubbleAction {
  label: () => string;
  ariaLabel: () => string;
  icon: string;
  title?: string;
  isActive: () => boolean;
  run: () => void;
}

function buildActions(editor: Editor): BubbleAction[] {
  return [
    {
      label: () => t('toolbar.bold'),
      ariaLabel: () => t('a11y.boldLabel'),
      icon: 'bold',
      title: 'Bold (Ctrl+B)',
      isActive: () => editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: () => t('toolbar.italic'),
      ariaLabel: () => t('a11y.italicLabel'),
      icon: 'italic',
      title: 'Italic (Ctrl+I)',
      isActive: () => editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: () => t('toolbar.strike'),
      ariaLabel: () => t('a11y.strikeLabel'),
      icon: 'strikethrough',
      title: 'Strikethrough',
      isActive: () => editor.isActive('strike'),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: () => t('bubble.underline'),
      ariaLabel: () => t('bubble.underline'),
      icon: 'underline',
      title: 'Underline (Ctrl+U)',
      isActive: () => editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: () => t('bubble.link'),
      ariaLabel: () => t('bubble.link'),
      icon: 'link',
      title: 'Link (Ctrl+K)',
      isActive: () => editor.isActive('link'),
      run: () => { /* handled via showLinkPopover in the button loop */ },
    },
  ];
}

function buildExtraActions(editor: Editor): BubbleAction[] {
  return [
    {
      label: () => 'Code',
      ariaLabel: () => 'Inline code',
      icon: 'inlineCode',
      title: 'Inline Code (Ctrl+`)',
      isActive: () => editor.isActive('code'),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: () => 'Clear',
      ariaLabel: () => 'Clear formatting',
      icon: 'clearFormatting',
      title: 'Clear formatting',
      isActive: () => false,
      run: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    },
    {
      label: () => 'Comment',
      ariaLabel: () => 'Add comment',
      icon: 'comment',
      title: 'Add comment',
      isActive: () => false,
      run: () => { document.dispatchEvent(new CustomEvent('opendesk:add-comment')); },
    },
    {
      label: () => 'AI',
      ariaLabel: () => 'AI Assist',
      icon: 'aiAssist',
      title: 'AI Assist',
      isActive: () => false,
      run: () => { document.dispatchEvent(new CustomEvent('opendesk:open-ai-assist')); },
    },
  ];
}

/**
 * Create a floating bubble menu that appears on text selection.
 * Shows icon-based formatting buttons at the point of selection.
 */
export function buildBubbleMenu(editor: Editor): void {
  const menu = document.createElement('div');
  menu.className = 'bubble-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', t('bubble.menuLabel'));
  document.body.appendChild(menu);

  const actions = buildActions(editor);
  const extraActions = buildExtraActions(editor);
  const allActions: BubbleAction[] = [...actions, ...extraActions];
  const buttons: HTMLButtonElement[] = [];

  function makeButton(action: BubbleAction): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bubble-menu-btn';
    const iconSvg = getIcon(action.icon);
    btn.innerHTML = iconSvg + `<span class="toolbar-btn-label">${action.label()}</span>`;
    btn.setAttribute('aria-label', action.ariaLabel());
    btn.setAttribute('title', action.title ?? action.ariaLabel());
    btn.setAttribute('aria-pressed', String(action.isActive()));
    return btn;
  }

  for (const action of actions) {
    const btn = makeButton(action);
    if (action.icon === 'link') {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        showLinkPopover(editor, btn);
      });
    } else {
      btn.addEventListener('mousedown', (e) => {
        // prevent editor losing focus before the click fires
        e.preventDefault();
        action.run();
        syncButtons();
      });
    }
    menu.appendChild(btn);
    buttons.push(btn);
  }

  const sep = document.createElement('span');
  sep.className = 'bubble-menu-separator';
  sep.setAttribute('role', 'separator');
  menu.appendChild(sep);

  for (const action of extraActions) {
    const btn = makeButton(action);
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      action.run();
      syncButtons();
    });
    menu.appendChild(btn);
    buttons.push(btn);
  }

  function syncButtons(): void {
    allActions.forEach((action, i) => {
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
