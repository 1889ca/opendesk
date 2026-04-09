/** Contract: contracts/app-sheets/rules.md */

/**
 * CellFormat shape used in the Yjs store and toolbar.
 * Matches CellFormatSchema from document/contract/spreadsheet.ts.
 */
export type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  alignment?: 'left' | 'center' | 'right';
  numberFormat?: NumberFormatType;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
};

export type NumberFormatType = 'general' | 'number' | 'currency' | 'percentage' | 'date';

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36] as const;

export const DEFAULT_FONT_SIZE = 13;

/**
 * Format a raw numeric value according to the specified number format.
 * Returns the display string; raw value is never mutated.
 */
export function formatNumber(value: string | number | boolean | null, fmt: NumberFormatType): string {
  if (value === null || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);

  switch (fmt) {
    case 'general':
      return String(value);
    case 'number':
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'currency':
      return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    case 'percentage':
      return (num * 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    case 'date': {
      const d = new Date(num);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('en-US');
    }
    default:
      return String(value);
  }
}

/** Returns true if format has any non-default property set. */
export function hasFormat(fmt: CellFormat | undefined): boolean {
  if (!fmt) return false;
  return Object.values(fmt).some((v) => v !== undefined);
}
