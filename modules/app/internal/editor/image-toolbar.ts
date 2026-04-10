/** Contract: contracts/app/rules.md */

import type { Editor } from '@tiptap/core';

type AlignKey = 'img-float-left' | 'img-center' | 'img-float-right' | 'img-full-width';

const ALIGN_OPTIONS: { key: AlignKey; label: string; title: string }[] = [
  { key: 'img-float-left',   label: '⬅',  title: 'Float left'  },
  { key: 'img-center',       label: '⬛',  title: 'Center'      },
  { key: 'img-float-right',  label: '➡',  title: 'Float right' },
  { key: 'img-full-width',   label: '⬜',  title: 'Full width'  },
];

const ALL_ALIGN_CLASSES = ALIGN_OPTIONS.map((o) => o.key);

let toolbar: HTMLElement | null = null;

function getOrCreateToolbar(): HTMLElement {
  if (toolbar) return toolbar;

  toolbar = document.createElement('div');
  toolbar.className = 'image-float-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Image alignment');
  document.body.appendChild(toolbar);

  return toolbar;
}

function showToolbar(editor: Editor, imgEl: HTMLElement): void {
  const el = getOrCreateToolbar();
  el.innerHTML = '';

  const currentClass = (editor.getAttributes('image').class as string) || '';

  for (const opt of ALIGN_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'image-float-btn' + (currentClass === opt.key ? ' is-active' : '');
    btn.title = opt.title;
    btn.textContent = opt.label;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const next = currentClass === opt.key ? '' : opt.key;
      editor.chain().focus().updateAttributes('image', {
        class: next,
        imageClass: next,
      }).run();
      hideToolbar();
    });
    el.appendChild(btn);
  }

  const rect = imgEl.getBoundingClientRect();
  el.style.position = 'fixed';
  el.style.top = `${rect.top - 40}px`;
  el.style.left = `${rect.left}px`;
  el.style.display = 'flex';
}

function hideToolbar(): void {
  if (toolbar) toolbar.style.display = 'none';
}

/** Initialise the image float/alignment toolbar for the given editor. */
export function initImageToolbar(editor: Editor): void {
  editor.on('selectionUpdate', () => {
    const { selection } = editor.state;
    const node = selection.$anchor.nodeAfter ?? (editor.state as any).doc.nodeAt(selection.from);

    if (node?.type.name === 'image') {
      const dom = editor.view.nodeDOM(selection.from) as HTMLElement | null;
      const imgEl = dom instanceof HTMLImageElement ? dom : dom?.querySelector('img') ?? dom;
      if (imgEl) {
        showToolbar(editor, imgEl as HTMLElement);
        return;
      }
    }
    hideToolbar();
  });

  editor.on('blur', () => {
    // Delay so toolbar button clicks fire before hiding
    setTimeout(() => {
      if (!toolbar?.matches(':focus-within') && !toolbar?.querySelector(':hover')) {
        hideToolbar();
      }
    }, 150);
  });

  editor.on('destroy', () => {
    toolbar?.remove();
    toolbar = null;
  });
}

export { ALL_ALIGN_CLASSES };
