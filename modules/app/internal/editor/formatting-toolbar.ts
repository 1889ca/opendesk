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

function renderToolbarButtons(
  toolbar: HTMLElement, buttons: ToolbarButton[], editor: Editor,
): void {
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
      // Icon mode: render SVG + visually-hidden label span
      btn.classList.add('toolbar-btn--icon');
      btn.innerHTML = iconSvg + `<span class="toolbar-btn-label">${labelText}</span>`;
    } else {
      btn.textContent = labelText;
    }

    if (titleText) btn.setAttribute('title', titleText);
    const ariaLabel = ariaKey ? t(ariaKey) : titleText || labelText;
    btn.setAttribute('aria-label', ariaLabel);

    if (isActive) btn.setAttribute('aria-pressed', String(isActive()));
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
    }
  }
}

/** Build the main formatting toolbar with all editor actions. */
export function buildFormattingToolbar(editor: Editor): void {
  const toolbar = document.getElementById('formatting-toolbar');
  if (!toolbar) return;
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', t('a11y.formattingToolbar'));
  const editorEl = () => document.querySelector('.editor-content') as HTMLElement | null;
  const render = () => {
    toolbar.innerHTML = '';
    renderToolbarButtons(toolbar, buildToolbarButtons(editor), editor);
    // Insert style select, font-family select and font-size select after the undo/redo separator (position 3)
    const styleSelect = buildStyleSelect(editor);
    const fontFamilySelect = buildFontFamilySelect(editor);
    const fontSizeSelect = buildFontSizeSelect(editor);
    const children = Array.from(toolbar.children);
    const insertBefore = children[3] ?? null;
    toolbar.insertBefore(styleSelect, insertBefore);
    toolbar.insertBefore(fontFamilySelect, styleSelect.nextSibling);
    toolbar.insertBefore(fontSizeSelect, fontFamilySelect.nextSibling);
    // Insert line-height select right after the font-size select
    const lineHeightSelect = buildLineHeightSelect(editor);
    toolbar.insertBefore(lineHeightSelect, fontSizeSelect.nextSibling);
    // Insert paragraph spacing select after line-height select
    const paraSpacingSelect = buildParagraphSpacingSelect(editor);
    toolbar.insertBefore(paraSpacingSelect, lineHeightSelect.nextSibling);
    // Append text color and highlight buttons
    const colorBtn = buildTextColorBtn(editor);
    toolbar.appendChild(colorBtn);
    const highlightBtn = buildHighlightBtn(editor);
    toolbar.appendChild(highlightBtn);
    // Append column layout select (document-level control, goes last)
    const columnSelect = buildColumnSelect(editor);
    toolbar.appendChild(columnSelect);
    updateRovingTabindex(toolbar);
  };
  render();
  setupToolbarOverflow(toolbar);
  document.addEventListener('opendesk:suggest-mode-changed', render);
  enableToolbarNavigation(toolbar, editorEl);
  onLocaleChange(() => { toolbar.setAttribute('aria-label', t('a11y.formattingToolbar')); render(); });
}
