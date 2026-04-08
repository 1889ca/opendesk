/** Contract: contracts/app/rules.md */

/** Column index → set of allowed values. */
export type FilterMap = Map<number, Set<string>>;

export type FilterChangeCallback = () => void;

export interface FilterState {
  setFilter(col: number, values: Set<string>): void;
  clearFilter(col: number): void;
  clearAll(): void;
  getFilter(col: number): Set<string> | undefined;
  hasActiveFilters(): boolean;
  isRowVisible(rowIndex: number, getData: (row: number, col: number) => string): boolean;
  onFilterChange(cb: FilterChangeCallback): void;
  destroy(): void;
}

/** Create a filter state manager. Filters are view-only (no Yjs mutation). */
export function createFilterState(): FilterState {
  const filters: FilterMap = new Map();
  const listeners: FilterChangeCallback[] = [];

  function notify(): void {
    for (const cb of listeners) cb();
  }

  return {
    setFilter(col: number, values: Set<string>): void {
      if (values.size === 0) {
        filters.delete(col);
      } else {
        filters.set(col, new Set(values));
      }
      notify();
    },

    clearFilter(col: number): void {
      if (filters.delete(col)) notify();
    },

    clearAll(): void {
      if (filters.size === 0) return;
      filters.clear();
      notify();
    },

    getFilter(col: number): Set<string> | undefined {
      return filters.get(col);
    },

    hasActiveFilters(): boolean {
      return filters.size > 0;
    },

    isRowVisible(rowIndex: number, getData: (row: number, col: number) => string): boolean {
      for (const [col, allowed] of filters) {
        const value = getData(rowIndex, col);
        if (!allowed.has(value)) return false;
      }
      return true;
    },

    onFilterChange(cb: FilterChangeCallback): void {
      listeners.push(cb);
    },

    destroy(): void {
      filters.clear();
      listeners.length = 0;
    },
  };
}
