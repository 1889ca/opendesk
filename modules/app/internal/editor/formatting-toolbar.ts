/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../i18n/index.ts';
import './page-break.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { enableToolbarNavigation, updateRovingTabindex } from './toolbar-nav.ts';
import { getIcon } from './toolbar-icons.ts';
import { buildTextColorBtn, buildHighlightBtn } from './toolbar-color-btn.ts';
import { buildAlignmentDropdown } from './alignment-select.ts';
import { buildStyleSelect } from './toolbar-selects.ts';
import { type ToolbarButton, buildToolbarButtons, buildButtonTitle } from './formatting-toolbar-actions.ts';
import { createScope, batchRaf, type Scope } from './lifecycle.ts';

export function renderToolbarButtons(
  toolbar: HTMLElement, buttons: ToolbarButton[], editor: Editor,
): () => void {
  // Collect all active-state updaters so we can batch them into ONE handler
  const activeUpdaters: Array<() => void> = [];

  for (const btnDef of buttons) {
    const { key, icon, ariaKey, action, isActive } = btnDef;
    if (key === null) {
      const sep = document.createElement('span');
      sep.className = 'toolbar-separator';
      sep.setAttribute('role', 'separator');
      toolbar.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.setAttribute('data-i18n-key', key);

    const iconSvg = icon ? getIcon(icon) : '';
    const labelText = t(key);
    const titleText = buildButtonTitle(btnDef);

    if (iconSvg) {
      btn.classList.add('toolbar-btn--icon');
      btn.innerHTML = iconSvg + `<span class="toolbar-btn-label">${labelText}</span>`;
    } else {
      btn.textContent = labelText;
    }

    if (titleText) btn.setAttribute('title', titleText);
    const ariaLabel = ariaKey ? t(ariaKey) : titleText || labelText;
    btn.setAttribute('aria-label', ariaLabel);

    if (isActive) btn.setAttribute('aria-pressed', String(isActive()));
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btnDef.passSelf ? action(btn) : action();
      if (isActive && btnDef.announceOnKey && btnDef.announceOffKey) {
        const active = isActive();
        btn.setAttribute('aria-pressed', String(active));
        announce(t(active ? btnDef.announceOnKey : btnDef.announceOffKey));
      }
    });
    toolbar.appendChild(btn);
    if (isActive) {
      activeUpdaters.push(() => {
        const active = isActive();
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }
  }

  // Single batched handler for ALL buttons instead of 2×N individual handlers
  if (activeUpdaters.length === 0) return () => {};
  const updateAll = () => { for (const fn of activeUpdaters) fn(); };
  const batched = batchRaf(updateAll);
  editor.on('selectionUpdate', batched.call);
  editor.on('transaction', batched.call);
  return () => {
    batched.cancel();
    editor.off('selectionUpdate', batched.call);
    editor.off('transaction', batched.call);
  };
}

/** Build the slim formatting toolbar — frequent actions only, no overflow. */
export function buildFormattingToolbar(editor: Editor): void {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('a11y.formattingToolbar'));
  const editorEl = () => document.querySelector('.editor-content') as HTMLElement | null;

  let scope: Scope | null = null;

  const render = () => {
    scope?.dispose();
    scope = createScope();
    toolbar.innerHTML = '';

    // Style select (Normal / Heading 1-6 / Code Block) — first element
    const styleSelect = buildStyleSelect(editor);
    scope.add(styleSelect.cleanup);
    toolbar.appendChild(styleSelect.el);
    const styleSep = document.createElement('span');
    styleSep.className = 'toolbar-separator';
    styleSep.setAttribute('role', 'separator');
    toolbar.appendChild(styleSep);

    const buttons = buildToolbarButtons(editor);
    scope.add(renderToolbarButtons(toolbar, buttons, editor));

    // Alignment dropdown (icon-based) after B/I/U/S + separator
    const alignDropdown = buildAlignmentDropdown(editor);
    scope.add(alignDropdown.cleanup);
    const children = Array.from(toolbar.children);
    // +2 offset for style select + separator already prepended
    const insertBefore = children[2 + 5] ?? null;
    toolbar.insertBefore(alignDropdown.el, insertBefore);

    // Append text color and highlight at the end
    const textColorBtn = buildTextColorBtn(editor);
    const highlightBtn = buildHighlightBtn(editor);
    scope.add(textColorBtn.cleanup);
    scope.add(highlightBtn.cleanup);
    toolbar.appendChild(textColorBtn.el);
    toolbar.appendChild(highlightBtn.el);

    updateRovingTabindex(toolbar);
  };

  render();
  document.addEventListener('opendesk:suggest-mode-changed', render);
  enableToolbarNavigation(toolbar, editorEl);
  onLocaleChange(() => {
    toolbar.setAttribute('aria-label', t('a11y.formattingToolbar'));
    render();
  });
}
