/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { buildStyleSelect, buildFontFamilySelect, buildFontSizeSelect, buildLineHeightSelect, buildParagraphSpacingSelect } from './toolbar-selects.ts';
import { buildColumnSelect } from './column-select.ts';
import type { PanelBlock } from './panel-system.ts';

function labeledRow(label: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'panel-field';
  const lbl = document.createElement('label');
  lbl.className = 'panel-field-label';
  lbl.textContent = label;
  row.append(lbl, control);
  return row;
}

export function buildStylesBlock(editor: Editor): PanelBlock {
  const content = document.createElement('div');
  content.className = 'panel-block-fields';

  const style = buildStyleSelect(editor);
  const font = buildFontFamilySelect(editor);
  const size = buildFontSizeSelect(editor);

  style.el.classList.add('panel-select');
  font.el.classList.add('panel-select');
  size.el.classList.add('panel-select');

  content.append(
    labeledRow('Style', style.el),
    labeledRow('Font', font.el),
    labeledRow('Size', size.el),
  );

  return {
    id: 'styles',
    title: 'Styles',
    content,
    cleanup: () => { style.cleanup(); font.cleanup(); size.cleanup(); },
  };
}

export function buildLayoutBlock(editor: Editor): PanelBlock {
  const content = document.createElement('div');
  content.className = 'panel-block-fields';

  const cols = buildColumnSelect(editor);
  const lineHeight = buildLineHeightSelect(editor);
  const paraSpacing = buildParagraphSpacingSelect(editor);

  content.append(
    labeledRow('Columns', cols),
    labeledRow('Line height', lineHeight.el),
    labeledRow('Spacing', paraSpacing),
  );

  return {
    id: 'layout',
    title: 'Layout',
    content,
    cleanup: () => { lineHeight.cleanup(); },
  };
}
