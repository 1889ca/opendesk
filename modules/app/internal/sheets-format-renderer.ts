/** Contract: contracts/sheets-formatting/rules.md */
import type { CellFormat } from './sheets-format-types.ts';
import { formatNumber } from './sheets-format-types.ts';

/**
 * Apply a CellFormat to a cell DOM element via inline styles.
 * Does not mutate the cell's text content for number formatting --
 * that is handled separately by getDisplayValue().
 */
export function applyCellFormat(cell: HTMLElement, fmt: CellFormat | undefined): void {
  // Reset to defaults first
  cell.style.fontWeight = '';
  cell.style.fontStyle = '';
  cell.style.textDecoration = '';
  cell.style.fontSize = '';
  cell.style.color = '';
  cell.style.backgroundColor = '';
  cell.style.textAlign = '';
  cell.style.borderTop = '';
  cell.style.borderBottom = '';
  cell.style.borderLeft = '';
  cell.style.borderRight = '';

  if (!fmt) return;

  if (fmt.bold) cell.style.fontWeight = '700';
  if (fmt.italic) cell.style.fontStyle = 'italic';

  const decorations: string[] = [];
  if (fmt.underline) decorations.push('underline');
  if (fmt.strikethrough) decorations.push('line-through');
  if (decorations.length > 0) cell.style.textDecoration = decorations.join(' ');

  if (fmt.fontSize) cell.style.fontSize = `${fmt.fontSize}px`;
  if (fmt.textColor) cell.style.color = fmt.textColor;
  if (fmt.backgroundColor) cell.style.backgroundColor = fmt.backgroundColor;
  if (fmt.alignment) cell.style.textAlign = fmt.alignment;

  const borderStyle = '1px solid #333';
  if (fmt.borderTop) cell.style.borderTop = borderStyle;
  if (fmt.borderBottom) cell.style.borderBottom = borderStyle;
  if (fmt.borderLeft) cell.style.borderLeft = borderStyle;
  if (fmt.borderRight) cell.style.borderRight = borderStyle;
}

/**
 * Get the display value for a cell, applying number formatting if set.
 * Raw value is never mutated.
 */
export function getDisplayValue(
  rawValue: string,
  fmt: CellFormat | undefined,
): string {
  if (!fmt?.numberFormat || fmt.numberFormat === 'general') return rawValue;
  return formatNumber(rawValue, fmt.numberFormat);
}
