/** Contract: contracts/app-sheets/rules.md */
import type { CondFormatRule, HighlightCondition } from './cond-format-rules.ts';
import { colLabel } from './grid-render.ts';

const RULE_TYPES = ['color-scale', 'data-bar', 'highlight', 'icon-set'] as const;
const HIGHLIGHT_CONDITIONS: HighlightCondition[] = [
  'greater', 'less', 'equal', 'between', 'text-contains',
];
const ICON_SETS = ['arrows', 'circles', 'flags'] as const;

/** Open the conditional format dialog. Calls onAdd when user submits a rule. */
export function openCondFormatDialog(
  onAdd: (rule: CondFormatRule) => void,
  defaultCol = 0,
): void {
  const existing = document.querySelector('.cond-format-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'cond-format-overlay');
  const dialog = el('div', 'cond-format-dialog');
  overlay.appendChild(dialog);

  dialog.appendChild(heading('Conditional Formatting'));

  const form = el('form', 'cond-format-form') as HTMLFormElement;
  dialog.appendChild(form);

  const typeSelect = selectField(form, 'Rule Type', RULE_TYPES as unknown as string[]);
  const colInput = numberField(form, 'Column Index', defaultCol, 0, 25);
  const dynamicArea = el('div', 'cond-format-dynamic');
  form.appendChild(dynamicArea);

  function rebuildDynamic() {
    dynamicArea.innerHTML = '';
    const ruleType = typeSelect.value;
    if (ruleType === 'color-scale') {
      colorField(dynamicArea, 'Min Color', '#63be7b', 'minColor');
      colorField(dynamicArea, 'Max Color', '#f8696b', 'maxColor');
    } else if (ruleType === 'data-bar') {
      colorField(dynamicArea, 'Bar Color', '#5b9bd5', 'barColor');
    } else if (ruleType === 'highlight') {
      const condSelect = selectField(dynamicArea, 'Condition', HIGHLIGHT_CONDITIONS);
      condSelect.dataset.field = 'condition';
      textField(dynamicArea, 'Value', 'hlValue');
      textField(dynamicArea, 'Value 2 (for between)', 'hlValue2');
      colorField(dynamicArea, 'Background', '#ffc7ce', 'hlBg');
      colorField(dynamicArea, 'Text Color', '#9c0006', 'hlText');
    } else if (ruleType === 'icon-set') {
      const iconSelect = selectField(dynamicArea, 'Icon Set', ICON_SETS as unknown as string[]);
      iconSelect.dataset.field = 'iconSet';
    }
  }

  typeSelect.addEventListener('change', rebuildDynamic);
  rebuildDynamic();

  const actions = el('div', 'cond-format-actions');
  const addBtn = button('Add Rule', 'cond-format-add-btn');
  const cancelBtn = button('Cancel', 'cond-format-cancel-btn');
  actions.appendChild(addBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  cancelBtn.addEventListener('click', (e) => { e.preventDefault(); overlay.remove(); });

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const rule = buildRule(typeSelect.value, parseInt(colInput.value, 10), dynamicArea);
    if (rule) {
      onAdd(rule);
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

function buildRule(type: string, colIndex: number, area: HTMLElement): CondFormatRule | null {
  if (type === 'color-scale') {
    return {
      type: 'color-scale', colIndex,
      minColor: getColorVal(area, 'minColor'),
      maxColor: getColorVal(area, 'maxColor'),
    };
  }
  if (type === 'data-bar') {
    return { type: 'data-bar', colIndex, color: getColorVal(area, 'barColor') };
  }
  if (type === 'highlight') {
    const cond = (area.querySelector('[data-field="condition"]') as HTMLSelectElement)?.value;
    return {
      type: 'highlight', colIndex,
      condition: (cond || 'greater') as HighlightCondition,
      value: getTextVal(area, 'hlValue'),
      value2: getTextVal(area, 'hlValue2') || undefined,
      bgColor: getColorVal(area, 'hlBg'),
      textColor: getColorVal(area, 'hlText') || undefined,
    };
  }
  if (type === 'icon-set') {
    const iconSet = (area.querySelector('[data-field="iconSet"]') as HTMLSelectElement)?.value;
    return {
      type: 'icon-set', colIndex,
      icons: (iconSet || 'arrows') as 'arrows' | 'circles' | 'flags',
    };
  }
  return null;
}

// --- DOM helpers ---

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function heading(text: string): HTMLElement {
  const h = document.createElement('h3');
  h.textContent = text;
  return h;
}

function selectField(parent: HTMLElement, label: string, options: string[]): HTMLSelectElement {
  const row = el('div', 'cond-format-field');
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const select = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt.replace(/-/g, ' ');
    select.appendChild(o);
  }
  row.appendChild(lbl);
  row.appendChild(select);
  parent.appendChild(row);
  return select;
}

function numberField(parent: HTMLElement, label: string, val: number, min: number, max: number): HTMLInputElement {
  const row = el('div', 'cond-format-field');
  const lbl = document.createElement('label');
  lbl.textContent = `${label} (${colLabel(val)})`;
  const input = document.createElement('input');
  input.type = 'number'; input.min = String(min); input.max = String(max);
  input.value = String(val);
  input.addEventListener('input', () => {
    lbl.textContent = `${label} (${colLabel(parseInt(input.value, 10) || 0)})`;
  });
  row.appendChild(lbl);
  row.appendChild(input);
  parent.appendChild(row);
  return input;
}

function colorField(parent: HTMLElement, label: string, defaultVal: string, name: string): void {
  const row = el('div', 'cond-format-field');
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'color'; input.value = defaultVal; input.dataset.colorField = name;
  row.appendChild(lbl);
  row.appendChild(input);
  parent.appendChild(row);
}

function textField(parent: HTMLElement, label: string, name: string): void {
  const row = el('div', 'cond-format-field');
  const lbl = document.createElement('label');
  lbl.textContent = label;
  const input = document.createElement('input');
  input.type = 'text'; input.dataset.textField = name;
  row.appendChild(lbl);
  row.appendChild(input);
  parent.appendChild(row);
}

function button(text: string, className: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className; btn.textContent = text;
  return btn;
}

function getColorVal(area: HTMLElement, name: string): string {
  return (area.querySelector(`[data-color-field="${name}"]`) as HTMLInputElement)?.value || '#000000';
}

function getTextVal(area: HTMLElement, name: string): string {
  return (area.querySelector(`[data-text-field="${name}"]`) as HTMLInputElement)?.value || '';
}
