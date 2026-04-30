/** Contract: contracts/app-sheets/rules.md */
import { AGGREGATION_LABELS, type AggregationType } from './pivot-aggregations.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function labeledSelect(
  parent: HTMLElement,
  labelText: string,
  options: string[],
  defaultVal?: string,
): HTMLSelectElement {
  const wrap = el('div', 'pivot-field');
  const lbl = el('label', 'pivot-label');
  lbl.textContent = labelText;
  const sel = el('select', 'pivot-select');
  for (const opt of options) {
    const o = el('option');
    o.value = opt;
    o.textContent = opt;
    if (opt === defaultVal) o.selected = true;
    sel.appendChild(o);
  }
  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  parent.appendChild(wrap);
  return sel;
}

export function checkboxGroup(
  parent: HTMLElement,
  labelText: string,
  options: string[],
): HTMLInputElement[] {
  const wrap = el('div', 'pivot-field');
  const lbl = el('label', 'pivot-label');
  lbl.textContent = labelText;
  wrap.appendChild(lbl);
  const inputs: HTMLInputElement[] = [];
  const list = el('div', 'pivot-checkbox-group');
  for (let i = 0; i < options.length; i++) {
    const row = el('label', 'pivot-checkbox-row');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.value = String(i);
    cb.dataset.idx = String(i);
    const span = el('span');
    span.textContent = options[i];
    row.appendChild(cb);
    row.appendChild(span);
    list.appendChild(row);
    inputs.push(cb);
  }
  wrap.appendChild(list);
  parent.appendChild(wrap);
  return inputs;
}

export function getCheckedIndices(inputs: HTMLInputElement[]): number[] {
  return inputs
    .filter((cb) => cb.checked)
    .map((cb) => parseInt(cb.value, 10));
}

export interface ValueFieldEntry {
  fieldSelect: HTMLSelectElement;
  aggSelect: HTMLSelectElement;
  container: HTMLElement;
}

export function createValueFieldEntry(
  parent: HTMLElement,
  headers: string[],
  removable: boolean,
  onRemove?: () => void,
): ValueFieldEntry {
  const container = el('div', 'pivot-value-entry');
  const fieldSel = el('select', 'pivot-select pivot-value-field-sel');
  for (let i = 0; i < headers.length; i++) {
    const o = el('option');
    o.value = String(i);
    o.textContent = headers[i] || `Column ${i + 1}`;
    fieldSel.appendChild(o);
  }

  const aggSel = el('select', 'pivot-select pivot-value-agg-sel');
  const aggTypes = Object.keys(AGGREGATION_LABELS) as AggregationType[];
  for (const agg of aggTypes) {
    const o = el('option');
    o.value = agg;
    o.textContent = AGGREGATION_LABELS[agg];
    aggSel.appendChild(o);
  }

  container.appendChild(fieldSel);
  container.appendChild(aggSel);

  if (removable && onRemove) {
    const removeBtn = el('button', 'pivot-btn pivot-remove-btn');
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', onRemove);
    container.appendChild(removeBtn);
  }

  parent.appendChild(container);
  return { fieldSelect: fieldSel, aggSelect: aggSel, container };
}
