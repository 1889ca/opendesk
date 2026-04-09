/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect, vi } from 'vitest';
import { createFilterState } from './filter-state.ts';

describe('createFilterState', () => {
  it('starts with no active filters', () => {
    const state = createFilterState();
    expect(state.hasActiveFilters()).toBe(false);
    expect(state.getFilter(0)).toBeUndefined();
  });

  it('setFilter stores allowed values for a column', () => {
    const state = createFilterState();
    state.setFilter(2, new Set(['A', 'B']));
    expect(state.hasActiveFilters()).toBe(true);
    expect(state.getFilter(2)).toEqual(new Set(['A', 'B']));
  });

  it('setFilter with empty set removes the filter', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['X']));
    state.setFilter(0, new Set());
    expect(state.hasActiveFilters()).toBe(false);
    expect(state.getFilter(0)).toBeUndefined();
  });

  it('clearFilter removes filter for specific column', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['A']));
    state.setFilter(1, new Set(['B']));
    state.clearFilter(0);
    expect(state.getFilter(0)).toBeUndefined();
    expect(state.getFilter(1)).toEqual(new Set(['B']));
  });

  it('clearAll removes all filters', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['A']));
    state.setFilter(1, new Set(['B']));
    state.clearAll();
    expect(state.hasActiveFilters()).toBe(false);
  });

  it('isRowVisible returns true when no filters active', () => {
    const state = createFilterState();
    const getData = () => 'any value';
    expect(state.isRowVisible(0, getData)).toBe(true);
  });

  it('isRowVisible returns true when cell value is in allowed set', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['yes', 'maybe']));
    const getData = (_row: number, _col: number) => 'yes';
    expect(state.isRowVisible(0, getData)).toBe(true);
  });

  it('isRowVisible returns false when cell value is not in allowed set', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['yes']));
    const getData = (_row: number, _col: number) => 'no';
    expect(state.isRowVisible(0, getData)).toBe(false);
  });

  it('isRowVisible checks all filter columns (AND logic)', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['A']));
    state.setFilter(1, new Set(['X']));

    const data: Record<string, string> = { '0:0': 'A', '0:1': 'Y' };
    const getData = (row: number, col: number) => data[`${row}:${col}`] ?? '';

    expect(state.isRowVisible(0, getData)).toBe(false);
  });

  it('notifies listeners on setFilter', () => {
    const state = createFilterState();
    const cb = vi.fn();
    state.onFilterChange(cb);
    state.setFilter(0, new Set(['A']));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on clearFilter', () => {
    const state = createFilterState();
    state.setFilter(0, new Set(['A']));
    const cb = vi.fn();
    state.onFilterChange(cb);
    state.clearFilter(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not notify on clearAll when already empty', () => {
    const state = createFilterState();
    const cb = vi.fn();
    state.onFilterChange(cb);
    state.clearAll();
    expect(cb).not.toHaveBeenCalled();
  });

  it('destroy clears filters and listeners', () => {
    const state = createFilterState();
    const cb = vi.fn();
    state.onFilterChange(cb);
    state.setFilter(0, new Set(['A']));
    cb.mockClear();

    state.destroy();
    expect(state.hasActiveFilters()).toBe(false);
    // After destroy, no more notifications
    state.setFilter(0, new Set(['A']));
    expect(cb).not.toHaveBeenCalled();
  });
});
