/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

const empty = grid({});

describe('YEAR / MONTH / DAY', () => {
  // DATE(2024, 3, 15) should return serial for 2024-03-15
  it('YEAR extracts year from serial date', () => {
    const serial = evaluateFormula('=DATE(2024, 3, 15)', empty, 'A1') as number;
    const g = grid({ A1: serial });
    expect(evaluateFormula('=YEAR(A1)', g, 'B1')).toBe(2024);
  });

  it('MONTH extracts month (1-12)', () => {
    const serial = evaluateFormula('=DATE(2024, 7, 1)', empty, 'A1') as number;
    const g = grid({ A1: serial });
    expect(evaluateFormula('=MONTH(A1)', g, 'B1')).toBe(7);
  });

  it('DAY extracts day of month', () => {
    const serial = evaluateFormula('=DATE(2024, 12, 25)', empty, 'A1') as number;
    const g = grid({ A1: serial });
    expect(evaluateFormula('=DAY(A1)', g, 'B1')).toBe(25);
  });
});

describe('HOUR / MINUTE / SECOND', () => {
  it('HOUR extracts hours from fractional day', () => {
    // 0.75 = 18:00:00 (6 PM)
    const g = grid({ A1: 0.75 });
    expect(evaluateFormula('=HOUR(A1)', g, 'B1')).toBe(18);
  });

  it('MINUTE extracts minutes', () => {
    // 0.5 + 30min/1440min = 0.520833... = 12:30
    const g = grid({ A1: 0.520833 });
    expect(evaluateFormula('=MINUTE(A1)', g, 'B1')).toBe(30);
  });

  it('SECOND extracts seconds', () => {
    // 45 seconds = 45/86400 = 0.000520833...
    const g = grid({ A1: 0.000520833 });
    expect(evaluateFormula('=SECOND(A1)', g, 'B1')).toBe(45);
  });
});

describe('WEEKDAY', () => {
  it('returns day of week (default type 1: Sun=1)', () => {
    // 2024-01-01 is a Monday
    const serial = evaluateFormula('=DATE(2024, 1, 1)', empty, 'A1') as number;
    const g = grid({ A1: serial });
    const result = evaluateFormula('=WEEKDAY(A1)', g, 'B1') as number;
    expect(result).toBe(2); // Monday = 2 in type 1
  });

  it('supports return type 2 (Mon=1)', () => {
    const serial = evaluateFormula('=DATE(2024, 1, 1)', empty, 'A1') as number;
    const g = grid({ A1: serial });
    expect(evaluateFormula('=WEEKDAY(A1, 2)', g, 'B1')).toBe(1); // Monday = 1
  });
});

describe('EOMONTH', () => {
  it('returns end of month after offset', () => {
    const start = evaluateFormula('=DATE(2024, 1, 15)', empty, 'A1') as number;
    const g = grid({ A1: start });
    const result = evaluateFormula('=EOMONTH(A1, 1)', g, 'B1') as number;
    // End of Feb 2024 (leap year) should be Feb 29
    const g2 = grid({ A1: result });
    expect(evaluateFormula('=DAY(A1)', g2, 'B1')).toBe(29);
    expect(evaluateFormula('=MONTH(A1)', g2, 'B1')).toBe(2);
  });

  it('handles negative month offset', () => {
    const start = evaluateFormula('=DATE(2024, 3, 10)', empty, 'A1') as number;
    const g = grid({ A1: start });
    const result = evaluateFormula('=EOMONTH(A1, -1)', g, 'B1') as number;
    const g2 = grid({ A1: result });
    expect(evaluateFormula('=MONTH(A1)', g2, 'B1')).toBe(2);
    expect(evaluateFormula('=DAY(A1)', g2, 'B1')).toBe(29); // Feb 2024 leap year
  });
});

describe('EDATE', () => {
  it('shifts date by months', () => {
    const start = evaluateFormula('=DATE(2024, 1, 31)', empty, 'A1') as number;
    const g = grid({ A1: start });
    const result = evaluateFormula('=EDATE(A1, 1)', g, 'B1') as number;
    const g2 = grid({ A1: result });
    expect(evaluateFormula('=MONTH(A1)', g2, 'B1')).toBe(3); // JS Date(2024, 2, 31) -> March 2
  });
});

describe('TIME', () => {
  it('returns fractional day from hour/minute/second', () => {
    expect(evaluateFormula('=TIME(12, 0, 0)', empty, 'A1')).toBe(0.5); // noon = 0.5
    expect(evaluateFormula('=TIME(6, 0, 0)', empty, 'A1')).toBe(0.25);
  });
});
