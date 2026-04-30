/** Contract: contracts/app-sheets/rules.md */
import { DISPLAY_MODE_LABELS, type DisplayMode } from './pivot-transforms.ts';
import type { PivotSort, PivotFilter, SortDirection } from './pivot-sort-filter.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export interface PivotOptionsResult {
  displayMode: DisplayMode;
  sort: PivotSort | null;
  filter: PivotFilter | null;
}

const SORT_CHOICES: [string, string][] = [
  ['none', 'Default (A\u2192Z)'],
  ['value_asc', 'By Value \u2191'],
  ['value_desc', 'By Value \u2193'],
  ['label_desc', 'Label Z\u2192A'],
];

const FILTER_CHOICES: [string, string][] = [
  ['none', 'Show All'],
  ['top_n', 'Top N'],
  ['bottom_n', 'Bottom N'],
  ['above', 'Above Threshold'],
  ['below', 'Below Threshold'],
];

export function createPivotOptions(parent: HTMLElement): {
  getOptions: () => PivotOptionsResult;
} {
  const section = el('details', 'pivot-options-section');
  const summary = el('summary');
  summary.textContent = 'Advanced Options';
  section.appendChild(summary);

  const content = el('div', 'pivot-options-content');
  section.appendChild(content);

  const dmWrap = el('div', 'pivot-field');
  const dmLabel = el('label', 'pivot-label');
  dmLabel.textContent = 'Show Values As';
  const dmSelect = el('select', 'pivot-select');
  for (const [key, label] of Object.entries(DISPLAY_MODE_LABELS)) {
    const o = el('option');
    o.value = key;
    o.textContent = label;
    dmSelect.appendChild(o);
  }
  dmWrap.appendChild(dmLabel);
  dmWrap.appendChild(dmSelect);
  content.appendChild(dmWrap);

  const sortWrap = el('div', 'pivot-field');
  const sortLabel = el('label', 'pivot-label');
  sortLabel.textContent = 'Sort Rows';
  const sortSelect = el('select', 'pivot-select');
  for (const [val, lbl] of SORT_CHOICES) {
    const o = el('option');
    o.value = val;
    o.textContent = lbl;
    sortSelect.appendChild(o);
  }
  sortWrap.appendChild(sortLabel);
  sortWrap.appendChild(sortSelect);
  content.appendChild(sortWrap);

  const filterWrap = el('div', 'pivot-field');
  const filterLabel = el('label', 'pivot-label');
  filterLabel.textContent = 'Filter Rows';
  const filterSelect = el('select', 'pivot-select');
  for (const [val, lbl] of FILTER_CHOICES) {
    const o = el('option');
    o.value = val;
    o.textContent = lbl;
    filterSelect.appendChild(o);
  }
  filterWrap.appendChild(filterLabel);
  filterWrap.appendChild(filterSelect);

  const filterInput = el('input', 'pivot-filter-input');
  filterInput.type = 'number';
  filterInput.placeholder = 'N or threshold';
  filterInput.style.display = 'none';
  filterWrap.appendChild(filterInput);
  content.appendChild(filterWrap);

  filterSelect.addEventListener('change', () => {
    filterInput.style.display = filterSelect.value === 'none' ? 'none' : '';
    filterInput.placeholder = filterSelect.value.includes('n')
      ? 'N (e.g. 10)'
      : 'Threshold';
  });

  parent.appendChild(section);

  return {
    getOptions(): PivotOptionsResult {
      const displayMode = dmSelect.value as DisplayMode;
      let sort: PivotSort | null = null;
      if (sortSelect.value !== 'none') {
        const by = sortSelect.value.startsWith('value') ? 'value' : 'label';
        const direction: SortDirection = sortSelect.value.endsWith('asc')
          ? 'asc'
          : 'desc';
        sort = { by, direction };
      }

      let filter: PivotFilter | null = null;
      if (filterSelect.value !== 'none') {
        const val = parseFloat(filterInput.value);
        if (!isNaN(val)) {
          filter = {
            type: filterSelect.value as PivotFilter['type'],
            valueIndex: 0,
            ...(filterSelect.value.includes('n')
              ? { n: val }
              : { threshold: val }),
          };
        }
      }

      return { displayMode, sort, filter };
    },
  };
}
