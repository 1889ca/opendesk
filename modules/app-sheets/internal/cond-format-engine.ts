/** Contract: contracts/app-sheets/rules.md */
import type { CondFormatRule, CondFormatResult } from './cond-format-rules.ts';

/** Interpolate between two hex colors. t is 0..1. */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const c1 = parseHex(color1);
  const c2 = parseHex(color2);
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(c1.r + (c2.r - c1.r) * clamped);
  const g = Math.round(c1.g + (c2.g - c1.g) * clamped);
  const b = Math.round(c1.b + (c2.b - c1.b) * clamped);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/** Extract numeric values from a column, ignoring non-numeric cells. */
function getColumnNumericRange(columnValues: string[]): { min: number; max: number } | null {
  const nums = columnValues.map(parseFloat).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function normalizeInRange(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/** Evaluate a single rule for a cell. Returns null if rule doesn't apply. */
function evaluateRule(
  rule: CondFormatRule, cellValue: string, columnValues: string[],
): CondFormatResult | null {
  const num = parseFloat(cellValue);

  if (rule.type === 'color-scale') {
    if (isNaN(num)) return null;
    const range = getColumnNumericRange(columnValues);
    if (!range) return null;
    const t = normalizeInRange(num, range.min, range.max);
    return { backgroundColor: interpolateColor(rule.minColor, rule.maxColor, t) };
  }

  if (rule.type === 'data-bar') {
    if (isNaN(num)) return null;
    const range = getColumnNumericRange(columnValues);
    if (!range || range.max === 0) return null;
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max));
    const width = maxAbs === 0 ? 0 : (Math.abs(num) / maxAbs) * 100;
    return { dataBarWidth: Math.min(100, Math.max(0, width)), backgroundColor: rule.color };
  }

  if (rule.type === 'highlight') {
    if (matchesHighlight(rule, cellValue)) {
      return { backgroundColor: rule.bgColor, textColor: rule.textColor };
    }
    return null;
  }

  if (rule.type === 'icon-set') {
    if (isNaN(num)) return null;
    const range = getColumnNumericRange(columnValues);
    if (!range) return null;
    const t = normalizeInRange(num, range.min, range.max);
    return { icon: pickIcon(rule.icons, t) };
  }

  return null;
}

function matchesHighlight(
  rule: Extract<CondFormatRule, { type: 'highlight' }>, cellValue: string,
): boolean {
  const num = parseFloat(cellValue);
  const threshold = parseFloat(rule.value);

  switch (rule.condition) {
    case 'greater': return !isNaN(num) && !isNaN(threshold) && num > threshold;
    case 'less': return !isNaN(num) && !isNaN(threshold) && num < threshold;
    case 'equal': return cellValue === rule.value;
    case 'between': {
      const upper = parseFloat(rule.value2 || '');
      return !isNaN(num) && !isNaN(threshold) && !isNaN(upper)
        && num >= threshold && num <= upper;
    }
    case 'text-contains': return cellValue.toLowerCase().includes(rule.value.toLowerCase());
    default: return false;
  }
}

const ICON_SETS = {
  arrows: ['▲', '►', '▼'],
  circles: ['●', '◐', '○'],
  flags: ['🟢', '🟡', '🔴'],
} as const;

function pickIcon(iconSet: 'arrows' | 'circles' | 'flags', t: number): string {
  const icons = ICON_SETS[iconSet];
  if (t >= 0.667) return icons[0];
  if (t >= 0.333) return icons[1];
  return icons[2];
}

/** Evaluate all rules for a cell, returning the first match. */
export function evaluateCondFormat(
  rules: CondFormatRule[], row: number, col: number,
  cellValue: string, columnValues: string[],
): CondFormatResult | null {
  for (const rule of rules) {
    if (rule.colIndex !== col) continue;
    const result = evaluateRule(rule, cellValue, columnValues);
    if (result) return result;
  }
  return null;
}
