/** Contract: contracts/app-sheets/rules.md */
import type { PivotResult } from './pivot-engine.ts';

export type DisplayMode =
  | 'value'
  | 'pct_row'
  | 'pct_col'
  | 'pct_grand'
  | 'rank_asc'
  | 'rank_desc'
  | 'running_total';

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  value: 'Raw Value',
  pct_row: '% of Row Total',
  pct_col: '% of Column Total',
  pct_grand: '% of Grand Total',
  rank_asc: 'Rank (Ascending)',
  rank_desc: 'Rank (Descending)',
  running_total: 'Running Total',
};

function keyOf(parts: string[]): string {
  return parts.join('\x00');
}

export function applyDisplayMode(
  result: PivotResult,
  valueIndex: number,
  mode: DisplayMode,
): PivotResult {
  if (mode === 'value') return result;
  const { rowKeys, colKeys, cells } = result;
  const newCells = new Map<string, (number | null)[]>();

  for (const rk of rowKeys) {
    for (const ck of colKeys) {
      const cellKey = `${keyOf(rk)}|||${keyOf(ck)}`;
      const vals = [...(cells.get(cellKey) ?? [])];
      const raw = vals[valueIndex];

      if (raw === null) {
        newCells.set(cellKey, vals);
        continue;
      }
      vals[valueIndex] = transformValue(raw, mode, rk, ck, valueIndex, result);
      newCells.set(cellKey, vals);
    }
  }

  return { ...result, cells: newCells };
}

function transformValue(
  raw: number,
  mode: DisplayMode,
  rk: string[],
  ck: string[],
  vi: number,
  result: PivotResult,
): number | null {
  switch (mode) {
    case 'pct_row': {
      const rt = result.rowTotals.get(keyOf(rk))?.[vi];
      return rt ? (raw / rt) * 100 : null;
    }
    case 'pct_col': {
      const ct = result.colTotals.get(keyOf(ck))?.[vi];
      return ct ? (raw / ct) * 100 : null;
    }
    case 'pct_grand': {
      const gt = result.grandTotal[vi];
      return gt ? (raw / gt) * 100 : null;
    }
    case 'rank_asc':
    case 'rank_desc': {
      const allInRow: number[] = [];
      for (const ck2 of result.colKeys) {
        const key = `${keyOf(rk)}|||${keyOf(ck2)}`;
        const v = result.cells.get(key)?.[vi];
        if (v !== null && v !== undefined) allInRow.push(v);
      }
      const sorted =
        mode === 'rank_asc'
          ? [...allInRow].sort((a, b) => a - b)
          : [...allInRow].sort((a, b) => b - a);
      return sorted.indexOf(raw) + 1;
    }
    case 'running_total': {
      let running = 0;
      for (const ck2 of result.colKeys) {
        const key = `${keyOf(rk)}|||${keyOf(ck2)}`;
        const v = result.cells.get(key)?.[vi];
        if (v !== null && v !== undefined) running += v;
        if (keyOf(ck2) === keyOf(ck)) return running;
      }
      return running;
    }
    default:
      return raw;
  }
}
