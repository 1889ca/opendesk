/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { t } from '../i18n/index.ts';
import { getIcon } from './toolbar-icons.ts';
import { showLinkPopover } from './link-popover.ts';
import { batchRaf } from './lifecycle.ts';
import { buildHeadingPicker } from './bubble-heading-picker.ts';

interface BubbleAction {
  label: () => string;
  ariaLabel: () => string;
  icon: string;
  isActive: () => boolean;
  run: () => void;
  /** If set, action gets special handling (e.g. 'link' opens popover). */
  special?: string;
}

/** Action groups separated by visual dividers. */
function buildGroups(editor: Editor): BubbleAction[][] {
  return [
    // Group 1: Core text formatting
    [
      {
        label: () => t('toolbar.bold'), ariaLabel: () => t('a11y.boldLabel'),
        icon: 'bold', isActive: () => editor.isActive('bold'),
        run: () => editor.chain().focus().toggleBold().run(),
      },
      {
        label: () => t('toolbar.italic'), ariaLabel: () => t('a11y.italicLabel'),
        icon: 'italic', isActive: () => editor.isActive('italic'),
        run: () => editor.chain().focus().toggleItalic().run(),
      },
      {
        label: () => t('bubble.underline'), ariaLabel: () => t('bubble.underline'),
        icon: 'underline', isActive: () => editor.isActive('underline'),
        run: () => editor.chain().focus().toggleUnderline().run(),
      },
      {
        label: () => t('toolbar.strike'), ariaLabel: () => t('a11y.strikeLabel'),
        icon: 'strikethrough', isActive: () => editor.isActive('strike'),
        run: () => editor.chain().focus().toggleStrike().run(),
      },
    ],
    // Group 2: Enhanced inline formatting
    [
      {
        label: () => t('bubble.code'), ariaLabel: () => t('bubble.code'),
        icon: 'inlineCode', isActive: () => editor.isActive('code'),
        run: () => editor.chain().focus().toggleCode().run(),
      },
      {
        label: () => t('bubble.highlight'), ariaLabel: () => t('bubble.highlight'),
        icon: 'highlight', isActive: () => editor.isActive('textHighlight'),
        run: () => {
          if (editor.isActive('textHighlight')) {
            editor.chain().focus().unsetTextHighlight().run();
          } else {
            editor.chain().focus().setTextHighlight('#fff176').run();
          }
        },
      },
    ],
    // Group 3: Structural — Link, Comment
    [
      {
        label: () => t('bubble.link'), ariaLabel: () => t('bubble.link'),
        icon: 'link', isActive: () => editor.isActive('link'),
        run: () => { /* handled via showLinkPopover */ }, special: 'link',
      },
      {
        label: () => t('bubble.comment'), ariaLabel: () => t('bubble.comment'),
        icon: 'comment', isActive: () => false,
        run: () => document.dispatchEvent(new CustomEvent('opendesk:add-comment')),
      },
    ],
  ];
}

/** Insert a thin vertical separator element. */
function createSep(): HTMLSpanElement {
  const sep = document.createElement('span');
  sep.className = 'bubble-menu-sep';
  sep.setAttribute('role', 'separator');
  sep.setAttribute('aria-orientation', 'vertical');
  return sep;
}

/**
 * Create a floating bubble menu that appears on text selection.
 * Shows grouped icon-based formatting buttons at the point of selection.
 */
export function buildBubbleMenu(editor: Editor): void {
  const menu = document.createElement('div');
  menu.className = 'bubble-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', t('bubble.menuLabel'));
  document.body.appendChild(menu);

  const groups = buildGroups(editor);
  const allActions: BubbleAction[] = [];
  const buttons: HTMLButtonElement[] = [];

  function syncButtons(): void {
    allActions.forEach((action, i) => {
      const active = action.isActive();
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-pressed', String(active));
    });
    const hBtn = menu.querySelector('.bubble-heading-btn');
    if (hBtn) hBtn.classList.toggle('is-active', editor.isActive('heading'));
  }

  for (let g = 0; g < groups.length; g++) {
    if (g > 0) menu.appendChild(createSep());
    // Insert heading picker at start of the structural group
    if (g === groups.length - 1) {
      menu.appendChild(buildHeadingPicker(editor, syncButtons));
    }
    for (const action of groups[g]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bubble-menu-btn';
      btn.innerHTML = getIcon(action.icon) +
        `<span class="toolbar-btn-label">${action.label()}</span>`;
      btn.setAttribute('aria-label', action.ariaLabel());
      btn.setAttribute('title', action.ariaLabel());
      btn.setAttribute('aria-pressed', String(action.isActive()));

      if (action.special === 'link') {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          showLinkPopover(editor, btn);
        });
      } else {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          action.run();
          syncButtons();
        });
      }
      menu.appendChild(btn);
      buttons.push(btn);
      allActions.push(action);
    }
  }

  const batched = batchRaf(syncButtons);
  editor.on('selectionUpdate', batched.call);
  editor.on('transaction', batched.call);

  editor.registerPlugin(
    BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element: menu,
    }),
  );
}
