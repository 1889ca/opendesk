/** Contract: contracts/sheets-formatting/rules.md */
import * as Y from 'yjs';
import { FONT_SIZES, type CellFormat, type NumberFormatType } from './sheets-format-types.ts';
import { getCellFormat, setCellFormat, toggleBoolFormat } from './sheets-format-store.ts';
import type { FormatToolbarCallbacks } from './sheets-format-toolbar.ts';

function makeButton(label: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'format-btn';
  btn.textContent = label;
  btn.title = title;
  return btn;
}

export function appendTextStyleButtons(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  const styles: Array<{ label: string; prop: 'bold' | 'italic' | 'underline' | 'strikethrough'; title: string }> = [
    { label: 'B', prop: 'bold', title: 'Bold (Ctrl+B)' },
    { label: 'I', prop: 'italic', title: 'Italic (Ctrl+I)' },
    { label: 'U', prop: 'underline', title: 'Underline (Ctrl+U)' },
    { label: 'S', prop: 'strikethrough', title: 'Strikethrough' },
  ];

  for (const { label, prop, title } of styles) {
    const btn = makeButton(label, title);
    btn.dataset.fmtToggle = prop;
    if (prop === 'bold') btn.style.fontWeight = '700';
    if (prop === 'italic') btn.style.fontStyle = 'italic';
    if (prop === 'underline') btn.style.textDecoration = 'underline';
    if (prop === 'strikethrough') btn.style.textDecoration = 'line-through';

    btn.addEventListener('click', () => {
      const { row, col } = cb.getActiveCell();
      toggleBoolFormat(ydoc, row, col, prop);
      cb.onFormatChanged();
    });
    bar.appendChild(btn);
  }
}

export function appendFontSizeSelector(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  const select = document.createElement('select');
  select.className = 'format-select';
  select.dataset.fmtFontsize = '';
  select.title = 'Font size';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Size';
  select.appendChild(defaultOpt);

  for (const size of FONT_SIZES) {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = String(size);
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const { row, col } = cb.getActiveCell();
    const val = select.value ? parseInt(select.value, 10) : undefined;
    setCellFormat(ydoc, row, col, { fontSize: val });
    cb.onFormatChanged();
  });
  bar.appendChild(select);
}

export function appendColorPickers(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  bar.appendChild(makeColorPicker('A', 'Text color', 'textColor', '#000000', ydoc, cb));
  bar.appendChild(makeColorPicker('\u25A0', 'Fill color', 'backgroundColor', '#ffff00', ydoc, cb));
}

function makeColorPicker(
  label: string, title: string, prop: 'textColor' | 'backgroundColor',
  defaultColor: string, ydoc: Y.Doc, cb: FormatToolbarCallbacks,
): HTMLLabelElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'format-color-wrapper';
  wrapper.title = title;

  const span = document.createElement('span');
  span.className = 'format-color-label';
  span.textContent = label;
  if (prop === 'textColor') span.style.borderBottom = `3px solid ${defaultColor}`;
  if (prop === 'backgroundColor') span.style.backgroundColor = defaultColor;

  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'format-color-input';
  input.value = defaultColor;

  input.addEventListener('input', () => {
    const { row, col } = cb.getActiveCell();
    setCellFormat(ydoc, row, col, { [prop]: input.value });
    if (prop === 'textColor') span.style.borderBottomColor = input.value;
    if (prop === 'backgroundColor') span.style.backgroundColor = input.value;
    cb.onFormatChanged();
  });

  wrapper.appendChild(span);
  wrapper.appendChild(input);
  return wrapper;
}

export function appendAlignmentButtons(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  const aligns: Array<{ label: string; value: 'left' | 'center' | 'right' }> = [
    { label: '\u2261', value: 'left' },
    { label: '\u2263', value: 'center' },
    { label: '\u2262', value: 'right' },
  ];

  for (const { label, value } of aligns) {
    const btn = makeButton(label, `Align ${value}`);
    btn.dataset.fmtAlign = value;
    btn.addEventListener('click', () => {
      const { row, col } = cb.getActiveCell();
      const current = getCellFormat(ydoc, row, col);
      const newAlign = current?.alignment === value ? undefined : value;
      setCellFormat(ydoc, row, col, { alignment: newAlign });
      cb.onFormatChanged();
    });
    bar.appendChild(btn);
  }
}

export function appendNumberFormatSelector(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  const select = document.createElement('select');
  select.className = 'format-select';
  select.dataset.fmtNumformat = '';
  select.title = 'Number format';

  const fmts: Array<{ value: NumberFormatType; label: string }> = [
    { value: 'general', label: 'General' },
    { value: 'number', label: '1,000.00' },
    { value: 'currency', label: '$1,000.00' },
    { value: 'percentage', label: '10.0%' },
    { value: 'date', label: 'Date' },
  ];

  for (const { value, label } of fmts) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const { row, col } = cb.getActiveCell();
    setCellFormat(ydoc, row, col, { numberFormat: select.value as NumberFormatType });
    cb.onFormatChanged();
  });
  bar.appendChild(select);
}

export function appendBorderButtons(bar: HTMLElement, ydoc: Y.Doc, cb: FormatToolbarCallbacks): void {
  const borders: Array<{ label: string; props: Partial<CellFormat>; title: string }> = [
    { label: '\u2581', props: { borderBottom: true }, title: 'Bottom border' },
    { label: '\u2594', props: { borderTop: true }, title: 'Top border' },
    { label: '\u258F', props: { borderLeft: true }, title: 'Left border' },
    { label: '\u2595', props: { borderRight: true }, title: 'Right border' },
    { label: '\u25A1', props: { borderTop: true, borderBottom: true, borderLeft: true, borderRight: true }, title: 'All borders' },
    { label: '\u00D7', props: { borderTop: false, borderBottom: false, borderLeft: false, borderRight: false }, title: 'No borders' },
  ];

  for (const { label, props, title } of borders) {
    const btn = makeButton(label, title);
    btn.addEventListener('click', () => {
      const { row, col } = cb.getActiveCell();
      setCellFormat(ydoc, row, col, props);
      cb.onFormatChanged();
    });
    bar.appendChild(btn);
  }
}
