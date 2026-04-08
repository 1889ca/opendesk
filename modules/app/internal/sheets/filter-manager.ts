/** Contract: contracts/app/rules.md */
import { createFilterState, type FilterState } from './filter-state.ts';
import { createFilterBar, type FilterBar } from './filter-bar.ts';
import { createFilterDropdown, type FilterDropdown } from './filter-dropdown.ts';

export interface FilterManagerDeps {
  gridEl: HTMLElement;
  getActiveSheetId: () => string;
  getActiveSheetLength: () => number;
  getCellValue: (sheetId: string, row: number, col: number) => string;
  doSort: (col: number, direction: 'asc' | 'desc') => void;
  onFilterChange: () => void;
  rows: number;
  cols: number;
}

export interface FilterManager {
  filterState: FilterState;
  afterRender(): void;
  destroy(): void;
}

/** Create the filter manager that wires filter state, bar, and dropdown. */
export function createFilterManager(deps: FilterManagerDeps): FilterManager {
  const { gridEl, getActiveSheetId, getActiveSheetLength, getCellValue, doSort, onFilterChange, rows, cols } = deps;

  const filterState = createFilterState();
  let filterBar: FilterBar | null = null;
  let activeDropdown: FilterDropdown | null = null;

  function getCellData(row: number, col: number): string {
    return getCellValue(getActiveSheetId(), row, col);
  }

  function openFilterDropdown(colIndex: number, anchorEl: HTMLElement): void {
    if (activeDropdown) { activeDropdown.destroy(); activeDropdown = null; }
    const dd = createFilterDropdown({
      gridEl, colIndex,
      getData: getCellData,
      rowCount: Math.min(getActiveSheetLength(), rows),
      currentFilter: filterState.getFilter(colIndex),
      onSort(direction) { doSort(colIndex, direction); },
      onFilter(values) {
        if (values.size === 0) filterState.clearFilter(colIndex);
        else filterState.setFilter(colIndex, values);
      },
    });
    const rect = anchorEl.getBoundingClientRect();
    dd.element.style.position = 'absolute';
    dd.element.style.left = `${rect.left}px`;
    dd.element.style.top = `${rect.bottom + 2}px`;
    document.body.appendChild(dd.element);
    activeDropdown = dd;

    const dismissHandler = (e: MouseEvent) => {
      if (!dd.element.contains(e.target as Node) && e.target !== anchorEl) {
        dd.destroy();
        activeDropdown = null;
        document.removeEventListener('mousedown', dismissHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', dismissHandler), 0);
  }

  filterState.onFilterChange(onFilterChange);

  return {
    filterState,
    afterRender(): void {
      if (!filterBar) {
        filterBar = createFilterBar(gridEl, filterState, openFilterDropdown);
      } else {
        filterBar.refresh();
      }
      filterBar.applyVisibility(gridEl, filterState, getCellData, rows, cols);
    },
    destroy(): void {
      if (activeDropdown) activeDropdown.destroy();
      if (filterBar) filterBar.destroy();
      filterState.destroy();
    },
  };
}
