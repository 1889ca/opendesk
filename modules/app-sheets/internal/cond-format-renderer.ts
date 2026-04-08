/** Contract: contracts/app-sheets/rules.md */
import type { CondFormatRule } from './cond-format-rules.ts';
import { evaluateCondFormat } from './cond-format-engine.ts';

const COND_CLASS = 'cond-fmt-applied';
const DATA_BAR_CLASS = 'cond-data-bar';
const ICON_CLASS = 'cond-icon';

/** Clear all conditional formatting artifacts from the grid. */
function clearCondFormatting(gridEl: HTMLElement): void {
  gridEl.querySelectorAll(`.${COND_CLASS}`).forEach((cell) => {
    const el = cell as HTMLElement;
    el.classList.remove(COND_CLASS);
    el.style.removeProperty('--cond-bg');
    el.style.removeProperty('--cond-text');
  });
  gridEl.querySelectorAll(`.${DATA_BAR_CLASS}`).forEach((el) => el.remove());
  gridEl.querySelectorAll(`.${ICON_CLASS}`).forEach((el) => el.remove());
}

/** Collect all values in a given column from the data getter. */
function collectColumnValues(
  getData: (row: number, col: number) => string, col: number, rows: number,
): string[] {
  const values: string[] = [];
  for (let r = 0; r < rows; r++) {
    values.push(getData(r, col));
  }
  return values;
}

/** Get the set of unique column indices referenced by rules. */
function getAffectedCols(rules: CondFormatRule[]): Set<number> {
  const cols = new Set<number>();
  for (const rule of rules) cols.add(rule.colIndex);
  return cols;
}

/**
 * Apply conditional formatting to the grid.
 * Must be called after the grid DOM is rendered.
 */
export function applyCondFormatting(
  gridEl: HTMLElement,
  rules: CondFormatRule[],
  getData: (row: number, col: number) => string,
  rows: number,
  cols: number,
): void {
  clearCondFormatting(gridEl);
  if (rules.length === 0) return;

  const affectedCols = getAffectedCols(rules);
  const columnCache = new Map<number, string[]>();

  for (const col of affectedCols) {
    columnCache.set(col, collectColumnValues(getData, col, rows));
  }

  for (let r = 0; r < rows; r++) {
    for (const col of affectedCols) {
      const cell = gridEl.querySelector<HTMLElement>(
        `[data-row="${r}"][data-col="${col}"]`,
      );
      if (!cell) continue;

      const cellValue = getData(r, col);
      const colValues = columnCache.get(col)!;
      const result = evaluateCondFormat(rules, r, col, cellValue, colValues);
      if (!result) continue;

      cell.classList.add(COND_CLASS);

      if (result.dataBarWidth !== undefined) {
        applyDataBar(cell, result.dataBarWidth, result.backgroundColor);
      } else if (result.backgroundColor) {
        cell.style.setProperty('--cond-bg', result.backgroundColor);
        cell.style.backgroundColor = result.backgroundColor;
      }

      if (result.textColor) {
        cell.style.setProperty('--cond-text', result.textColor);
        cell.style.color = result.textColor;
      }

      if (result.icon) {
        applyIcon(cell, result.icon);
      }
    }
  }
}

function applyDataBar(cell: HTMLElement, widthPct: number, color?: string): void {
  cell.style.position = 'relative';
  const bar = document.createElement('div');
  bar.className = DATA_BAR_CLASS;
  bar.style.width = `${widthPct}%`;
  if (color) bar.style.backgroundColor = color;
  cell.insertBefore(bar, cell.firstChild);
}

function applyIcon(cell: HTMLElement, icon: string): void {
  const span = document.createElement('span');
  span.className = ICON_CLASS;
  span.textContent = icon;
  cell.insertBefore(span, cell.firstChild);
}
