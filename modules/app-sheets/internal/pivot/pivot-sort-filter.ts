/** Contract: contracts/app-sheets/rules.md */
import type { PivotResult } from './pivot-engine.ts';

export type SortDirection = 'asc' | 'desc';

export interface PivotSort {
  by: 'label' | 'value';
  direction: SortDirection;
  valueIndex?: number;
  colKeyIndex?: number;
}

export interface PivotFilter {
  type: 'top_n' | 'bottom_n' | 'above' | 'below';
  n?: number;
  threshold?: number;
  valueIndex: number;
}

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

export function sortPivotRows(
  result: PivotResult,
  sort: PivotSort,
): PivotResult {
  const { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = result;

  const sorted = [...rowKeys].sort((a, b) => {
    if (sort.by === 'label') {
      const cmp = keyOf(a).localeCompare(keyOf(b));
      return sort.direction === 'asc' ? cmp : -cmp;
    }
    const vi = sort.valueIndex ?? 0;
    let valA: number | null;
    let valB: number | null;

    if (
      sort.colKeyIndex !== undefined &&
      sort.colKeyIndex < colKeys.length
    ) {
      const ck = colKeys[sort.colKeyIndex];
      valA = cells.get(`${keyOf(a)}|||${keyOf(ck)}`)?.[vi] ?? null;
      valB = cells.get(`${keyOf(b)}|||${keyOf(ck)}`)?.[vi] ?? null;
    } else {
      valA = rowTotals.get(keyOf(a))?.[vi] ?? null;
      valB = rowTotals.get(keyOf(b))?.[vi] ?? null;
    }

    const na = valA ?? (sort.direction === 'asc' ? Infinity : -Infinity);
    const nb = valB ?? (sort.direction === 'asc' ? Infinity : -Infinity);
    return sort.direction === 'asc' ? na - nb : nb - na;
  });

  return { rowKeys: sorted, colKeys, cells, rowTotals, colTotals, grandTotal };
}

export function filterPivotRows(
  result: PivotResult,
  filter: PivotFilter,
): PivotResult {
  const { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal } = result;
  const vi = filter.valueIndex;

  const scored = rowKeys.map((rk) => ({
    rk,
    val: rowTotals.get(keyOf(rk))?.[vi] ?? null,
  }));

  let filtered: string[][];

  switch (filter.type) {
    case 'top_n': {
      const n = filter.n ?? 10;
      filtered = scored
        .filter((s) => s.val !== null)
        .sort((a, b) => (b.val ?? 0) - (a.val ?? 0))
        .slice(0, n)
        .map((s) => s.rk);
      break;
    }
    case 'bottom_n': {
      const n = filter.n ?? 10;
      filtered = scored
        .filter((s) => s.val !== null)
        .sort((a, b) => (a.val ?? 0) - (b.val ?? 0))
        .slice(0, n)
        .map((s) => s.rk);
      break;
    }
    case 'above':
      filtered = scored
        .filter((s) => s.val !== null && s.val > (filter.threshold ?? 0))
        .map((s) => s.rk);
      break;
    case 'below':
      filtered = scored
        .filter((s) => s.val !== null && s.val < (filter.threshold ?? 0))
        .map((s) => s.rk);
      break;
  }

  return { rowKeys: filtered, colKeys, cells, rowTotals, colTotals, grandTotal };
}
