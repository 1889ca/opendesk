/** Contract: contracts/app-sheets/rules.md */
import type { FilterState } from './filter-state.ts';

export interface FilterBar {
  refresh(): void;
  applyVisibility(
    gridEl: HTMLElement,
    filterState: FilterState,
    getData: (row: number, col: number) => string,
    rows: number,
    cols: number,
  ): void;
  destroy(): void;
}

const FUNNEL_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.5 1h9L6 4.5V8L4 9V4.5L0.5 1Z" stroke="currentColor" stroke-width="1" fill="none"/>
</svg>`;

const FUNNEL_ACTIVE_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.5 1h9L6 4.5V8L4 9V4.5L0.5 1Z" stroke="currentColor" stroke-width="1" fill="currentColor"/>
</svg>`;

/** Add filter icons to column headers and manage row visibility. */
export function createFilterBar(
  gridEl: HTMLElement,
  filterState: FilterState,
  onOpenDropdown: (colIndex: number, anchorEl: HTMLElement) => void,
): FilterBar {
  function addIcons(): void {
    const headers = Array.from(gridEl.querySelectorAll<HTMLElement>('[data-col-header]'));
    for (const hdr of headers) {
      // Remove old icon if present
      const old = hdr.querySelector('.sheet-filter-icon');
      if (old) old.remove();

      const col = Number(hdr.dataset.colHeader);
      const btn = document.createElement('span');
      btn.className = 'sheet-filter-icon';
      const hasFilter = filterState.getFilter(col) !== undefined;
      btn.innerHTML = hasFilter ? FUNNEL_ACTIVE_SVG : FUNNEL_SVG;
      if (hasFilter) btn.classList.add('sheet-filter-icon--active');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpenDropdown(col, hdr);
      });
      hdr.appendChild(btn);
    }
  }

  function applyVisibility(
    grid: HTMLElement,
    state: FilterState,
    getData: (row: number, col: number) => string,
    rows: number,
    cols: number,
  ): void {
    if (!state.hasActiveFilters()) return;

    for (let r = 0; r < rows; r++) {
      const visible = state.isRowVisible(r, getData);
      // Hide/show row header
      const rowHeader = grid.querySelector<HTMLElement>(`[data-row-header="${r}"]`);
      if (rowHeader) rowHeader.style.display = visible ? '' : 'none';
      // Hide/show each cell in the row
      for (let c = 0; c < cols; c++) {
        const cell = grid.querySelector<HTMLElement>(
          `[data-row="${r}"][data-col="${c}"]`,
        );
        if (cell) cell.style.display = visible ? '' : 'none';
      }
    }
  }

  addIcons();

  return {
    refresh(): void {
      addIcons();
    },
    applyVisibility,
    destroy(): void {
      const icons = Array.from(gridEl.querySelectorAll('.sheet-filter-icon'));
      for (const icon of icons) icon.remove();
    },
  };
}
