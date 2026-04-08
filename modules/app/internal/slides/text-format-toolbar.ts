/** Contract: contracts/app/slides-element-types.md */

import type { Editor } from '@tiptap/core';
import type { TextAlign } from './types.ts';

export type FormatToolbarConfig = {
  fontSize: number;
  fontColor: string;
  textAlign: TextAlign;
  onFontSizeChange: (size: number) => void;
  onFontColorChange: (color: string) => void;
  onTextAlignChange: (align: TextAlign) => void;
};

export type FormatToolbar = {
  element: HTMLElement;
  update: (editor: Editor) => void;
  destroy: () => void;
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 60, 72];

/** Create a formatting toolbar for a text element in edit mode */
export function createFormatToolbar(
  editor: Editor,
  config: FormatToolbarConfig,
): FormatToolbar {
  const bar = document.createElement('div');
  bar.className = 'slide-format-toolbar';

  // Bold
  const boldBtn = createMarkButton(bar, 'B', 'bold', editor);
  boldBtn.style.fontWeight = 'bold';

  // Italic
  const italicBtn = createMarkButton(bar, 'I', 'italic', editor);
  italicBtn.style.fontStyle = 'italic';

  // Underline
  const underlineBtn = createMarkButton(bar, 'U', 'underline', editor);
  underlineBtn.style.textDecoration = 'underline';

  // Strikethrough
  const strikeBtn = createMarkButton(bar, 'S', 'strike', editor);
  strikeBtn.style.textDecoration = 'line-through';

  addSeparator(bar);

  // Font size dropdown
  const fontSelect = createFontSizeSelect(config.fontSize, (size) => {
    config.onFontSizeChange(size);
  });
  bar.appendChild(fontSelect);

  // Color picker
  const colorPicker = createColorPicker(config.fontColor, (color) => {
    config.onFontColorChange(color);
  });
  bar.appendChild(colorPicker);

  addSeparator(bar);

  // Alignment buttons
  const alignGroup = document.createElement('div');
  alignGroup.className = 'slide-format-align-group';
  createAlignButton(alignGroup, 'left', config, editor);
  createAlignButton(alignGroup, 'center', config, editor);
  createAlignButton(alignGroup, 'right', config, editor);
  bar.appendChild(alignGroup);

  function update(ed: Editor) {
    boldBtn.classList.toggle('active', ed.isActive('bold'));
    italicBtn.classList.toggle('active', ed.isActive('italic'));
    underlineBtn.classList.toggle('active', ed.isActive('underline'));
    strikeBtn.classList.toggle('active', ed.isActive('strike'));
  }

  update(editor);

  return { element: bar, update, destroy: () => bar.remove() };
}

function createMarkButton(
  parent: HTMLElement,
  label: string,
  mark: string,
  editor: Editor,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'slide-format-btn';
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevent blur
    editor.chain().focus().toggleMark(mark).run();
    btn.classList.toggle('active', editor.isActive(mark));
  });
  parent.appendChild(btn);
  return btn;
}

function createFontSizeSelect(
  current: number,
  onChange: (size: number) => void,
): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'slide-format-font-size';
  for (const size of FONT_SIZES) {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = `${size}px`;
    if (size === current) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    onChange(Number(select.value));
  });
  return select;
}

function createColorPicker(
  current: string,
  onChange: (color: string) => void,
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'slide-format-color';
  input.value = current;
  input.addEventListener('input', () => {
    onChange(input.value);
  });
  return input;
}

function createAlignButton(
  parent: HTMLElement,
  align: TextAlign,
  config: FormatToolbarConfig,
  _editor: Editor,
): void {
  const btn = document.createElement('button');
  btn.className = 'slide-format-btn slide-format-align-btn';
  btn.type = 'button';
  btn.dataset.align = align;
  if (config.textAlign === align) btn.classList.add('active');

  const icons: Record<TextAlign, string> = {
    left: '\u2261',    // hamburger-left
    center: '\u2550',  // center lines
    right: '\u2261',   // hamburger-right (mirrored via CSS)
  };
  btn.textContent = icons[align];
  btn.title = `Align ${align}`;

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    config.onTextAlignChange(align);
    const siblings = parent.querySelectorAll('.slide-format-align-btn');
    siblings.forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
  });

  parent.appendChild(btn);
}

function addSeparator(parent: HTMLElement): void {
  const sep = document.createElement('div');
  sep.className = 'slide-format-separator';
  parent.appendChild(sep);
}
