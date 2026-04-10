/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../i18n/index.ts';
import { setupToolbarOverflow } from './toolbar-overflow.ts';
import './page-break.ts';
import { announce } from '../shared/a11y-announcer.ts';
import { enableToolbarNavigation, updateRovingTabindex } from './toolbar-nav.ts';
import { getIcon } from './toolbar-icons.ts';
import { buildTextColorBtn, buildHighlightBtn } from './toolbar-color-btn.ts';
import { buildFontFamilySelect, buildFontSizeSelect, buildLineHeightSelect, buildParagraphSpacingSelect, buildStyleSelect } from './toolbar-selects.ts';
import { buildColumnSelect } from './column-select.ts';
import { type ToolbarButton, buildToolbarButtons, buildButtonTitle } from './formatting-toolbar-actions.ts';

export function renderToolbarButtons(
  toolbar: HTMLElement, buttons: ToolbarButton[], editor: Editor,
): () => void {
  const cleanups: Array<() => void> = [];

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
      const update = () => {
        const active = isActive();
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      };
      editor.on('selectionUpdate', update);
      editor.on('transaction', update);
      cleanups.push(() => {
        editor.off('selectionUpdate', update);
        editor.off('transaction', update);
      });
    }
  }

  return () => { for (const fn of cleanups) fn(); };
}

/** Build the overflow (More ···) item list: buttons + select rows. Returns elements + cleanup fn. */
function buildOverflowItems(overflowBtns: ToolbarButton[], editor: Editor): { els: HTMLElement[]; cleanup: () => void } {
  const temp = document.createElement('div');
  const cleanup = renderToolbarButtons(temp, overflowBtns, editor);

  const els = Array.from(temp.children) as HTMLElement[];

  // Append select rows with labels at the end (document formatting)
  const selectDivider = document.createElement('span');
  selectDivider.className = 'toolbar-separator';
  selectDivider.setAttribute('role', 'separator');
  els.push(selectDivider);
  els.push(buildSelectRow('Line spacing', buildLineHeightSelect(editor)));
  els.push(buildSelectRow('Paragraph spacing', buildParagraphSpacingSelect(editor)));
  els.push(buildSelectRow('Columns', buildColumnSelect(editor)));

  return { els, cleanup };
}

function buildSelectRow(label: string, select: HTMLElement): HTMLElement {
  const row = document.createElement('label');
  row.className = 'overflow-select-row';
  const span = document.createElement('span');
  span.className = 'overflow-select-label';
  span.textContent = label;
  row.append(span, select);
  return row;
}

/** Build the main formatting toolbar with primary actions + More (···) overflow menu. */
export function buildFormattingToolbar(editor: Editor): void {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('a11y.formattingToolbar'));
  const editorEl = () => document.querySelector('.editor-content') as HTMLElement | null;

  let cleanupAll: (() => void) | null = null;

  const render = () => {
    cleanupAll?.();
    toolbar.innerHTML = '';

    const allButtons = buildToolbarButtons(editor);
    const primaryBtns = allButtons.filter(b => !b.priority);
    const overflowBtns = allButtons.filter(b => b.priority === 'overflow');

    const primaryCleanup = renderToolbarButtons(toolbar, primaryBtns, editor);

    // Insert style / font / size selects at position 3 (after undo/redo/separator)
    const styleSelect = buildStyleSelect(editor);
    const fontFamilySelect = buildFontFamilySelect(editor);
    const fontSizeSelect = buildFontSizeSelect(editor);
    const children = Array.from(toolbar.children);
    const insertBefore = children[3] ?? null;
    toolbar.insertBefore(styleSelect, insertBefore);
    toolbar.insertBefore(fontFamilySelect, styleSelect.nextSibling);
    toolbar.insertBefore(fontSizeSelect, fontFamilySelect.nextSibling);

    // Append text color and highlight to primary toolbar
    toolbar.appendChild(buildTextColorBtn(editor));
    toolbar.appendChild(buildHighlightBtn(editor));

    // Build overflow elements and set up the permanent More (···) menu
    const { els: overflowEls, cleanup: overflowBtnCleanup } = buildOverflowItems(overflowBtns, editor);
    const overflowCleanup = setupToolbarOverflow(toolbar, overflowEls);

    cleanupAll = () => { primaryCleanup(); overflowBtnCleanup(); overflowCleanup(); };

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
