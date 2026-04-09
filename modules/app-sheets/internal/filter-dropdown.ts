/** Contract: contracts/app-sheets/rules.md */

export interface FilterDropdownOptions {
  gridEl: HTMLElement;
  colIndex: number;
  getData: (row: number, col: number) => string;
  rowCount: number;
  currentFilter: Set<string> | undefined;
  onSort: (direction: 'asc' | 'desc') => void;
  onFilter: (values: Set<string>) => void;
}

export interface FilterDropdown {
  element: HTMLElement;
  destroy(): void;
}

/** Collect unique values from a column. */
function getUniqueValues(
  getData: (row: number, col: number) => string,
  col: number,
  rowCount: number,
): string[] {
  const seen = new Set<string>();
  for (let r = 0; r < rowCount; r++) {
    seen.add(getData(r, col));
  }
  return Array.from(seen).sort((a, b) => {
    if (a === '' && b === '') return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

/** Create the filter dropdown UI for a column. */
export function createFilterDropdown(opts: FilterDropdownOptions): FilterDropdown {
  const { colIndex, getData, rowCount, currentFilter, onSort, onFilter } = opts;
  const el = document.createElement('div');
  el.className = 'sheet-filter-dropdown';

  // Sort buttons
  const sortSection = document.createElement('div');
  sortSection.className = 'sheet-filter-sort-section';
  const sortAsc = document.createElement('button');
  sortAsc.className = 'sheet-filter-sort-btn';
  sortAsc.textContent = 'Sort A \u2192 Z';
  sortAsc.addEventListener('click', () => { onSort('asc'); destroy(); });
  const sortDesc = document.createElement('button');
  sortDesc.className = 'sheet-filter-sort-btn';
  sortDesc.textContent = 'Sort Z \u2192 A';
  sortDesc.addEventListener('click', () => { onSort('desc'); destroy(); });
  sortSection.append(sortAsc, sortDesc);
  el.appendChild(sortSection);

  // Separator
  const sep = document.createElement('hr');
  sep.className = 'sheet-filter-sep';
  el.appendChild(sep);

  // Value checkboxes
  const values = getUniqueValues(getData, colIndex, rowCount);
  const checked = new Set<string>(currentFilter ?? values);

  const listWrap = document.createElement('div');
  listWrap.className = 'sheet-filter-list';

  // Select All / Clear row
  const bulkRow = document.createElement('div');
  bulkRow.className = 'sheet-filter-bulk';
  const selectAllBtn = document.createElement('button');
  selectAllBtn.textContent = 'Select All';
  selectAllBtn.className = 'sheet-filter-bulk-btn';
  selectAllBtn.addEventListener('click', () => {
    checked.clear();
    for (const v of values) checked.add(v);
    updateCheckboxes();
  });
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.className = 'sheet-filter-bulk-btn';
  clearBtn.addEventListener('click', () => {
    checked.clear();
    updateCheckboxes();
  });
  bulkRow.append(selectAllBtn, clearBtn);
  el.appendChild(bulkRow);

  const checkboxes: Array<{ input: HTMLInputElement; value: string }> = [];

  for (const val of values) {
    const label = document.createElement('label');
    label.className = 'sheet-filter-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked.has(val);
    input.addEventListener('change', () => {
      if (input.checked) checked.add(val);
      else checked.delete(val);
    });
    const span = document.createElement('span');
    span.textContent = val === '' ? '(Blanks)' : val;
    label.append(input, span);
    listWrap.appendChild(label);
    checkboxes.push({ input, value: val });
  }
  el.appendChild(listWrap);

  function updateCheckboxes(): void {
    for (const cb of checkboxes) {
      cb.input.checked = checked.has(cb.value);
    }
  }

  // Apply button
  const applyBtn = document.createElement('button');
  applyBtn.className = 'sheet-filter-apply-btn';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    // If all values selected, clear filter for this column
    if (checked.size === values.length) {
      onFilter(new Set<string>());
    } else {
      onFilter(new Set(checked));
    }
    destroy();
  });
  el.appendChild(applyBtn);

  function destroy(): void {
    el.remove();
  }

  return { element: el, destroy };
}
