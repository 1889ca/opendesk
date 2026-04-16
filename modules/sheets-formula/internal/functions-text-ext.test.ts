/** Contract: contracts/sheets-formula/rules.md */
import { describe, it, expect } from 'vitest';
import { type CellGrid, type FormulaError, evaluateFormula, FormulaErrorType } from '../index.ts';

function grid(data: Record<string, number | string | boolean | null>): CellGrid {
  return new Map(Object.entries(data));
}

const empty = grid({});

describe('SUBSTITUTE', () => {
  it('replaces all occurrences', () => {
    expect(evaluateFormula('=SUBSTITUTE("aabaa", "a", "x")', empty, 'A1')).toBe('xxbxx');
  });
  it('replaces nth instance only', () => {
    expect(evaluateFormula('=SUBSTITUTE("aabaa", "a", "x", 3)', empty, 'A1')).toBe('aabxa');
  });
});

describe('FIND', () => {
  it('finds case-sensitive substring (1-based)', () => {
    expect(evaluateFormula('=FIND("World", "Hello World")', empty, 'A1')).toBe(7);
  });
  it('respects start_num', () => {
    expect(evaluateFormula('=FIND("l", "Hello", 4)', empty, 'A1')).toBe(4);
  });
  it('returns #VALUE! when not found', () => {
    const r = evaluateFormula('=FIND("xyz", "Hello")', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('SEARCH', () => {
  it('finds case-insensitive substring', () => {
    expect(evaluateFormula('=SEARCH("world", "Hello World")', empty, 'A1')).toBe(7);
  });
  it('supports wildcards', () => {
    expect(evaluateFormula('=SEARCH("w*d", "Hello World")', empty, 'A1')).toBe(7);
  });
});

describe('EXACT', () => {
  it('returns true for identical strings', () => {
    expect(evaluateFormula('=EXACT("hello", "hello")', empty, 'A1')).toBe(true);
  });
  it('returns false for case mismatch', () => {
    expect(evaluateFormula('=EXACT("Hello", "hello")', empty, 'A1')).toBe(false);
  });
});

describe('REPT', () => {
  it('repeats text n times', () => {
    expect(evaluateFormula('=REPT("ab", 3)', empty, 'A1')).toBe('ababab');
  });
  it('returns empty for 0 repeats', () => {
    expect(evaluateFormula('=REPT("x", 0)', empty, 'A1')).toBe('');
  });
});

describe('PROPER', () => {
  it('capitalizes first letter of each word', () => {
    expect(evaluateFormula('=PROPER("hello world")', empty, 'A1')).toBe('Hello World');
  });
});

describe('VALUE', () => {
  it('converts string to number', () => {
    expect(evaluateFormula('=VALUE("42.5")', empty, 'A1')).toBe(42.5);
  });
  it('strips currency symbols', () => {
    expect(evaluateFormula('=VALUE("$1,000")', empty, 'A1')).toBe(1000);
  });
  it('returns #VALUE! for non-numeric', () => {
    const r = evaluateFormula('=VALUE("hello")', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('CHAR / CODE', () => {
  it('CHAR returns character from code', () => {
    expect(evaluateFormula('=CHAR(65)', empty, 'A1')).toBe('A');
  });
  it('CODE returns code from character', () => {
    expect(evaluateFormula('=CODE("A")', empty, 'A1')).toBe(65);
  });
  it('CODE errors on empty string', () => {
    const r = evaluateFormula('=CODE("")', empty, 'A1') as FormulaError;
    expect(r.error).toBe(FormulaErrorType.VALUE);
  });
});

describe('REPLACE', () => {
  it('replaces part of text by position', () => {
    expect(evaluateFormula('=REPLACE("abcdef", 3, 2, "XY")', empty, 'A1')).toBe('abXYef');
  });
});

describe('TEXTJOIN', () => {
  it('joins with delimiter', () => {
    const g = grid({ A1: 'a', A2: 'b', A3: 'c' });
    expect(evaluateFormula('=TEXTJOIN(",", TRUE, A1, A2, A3)', g, 'D1')).toBe('a,b,c');
  });
  it('ignores empty when flag set', () => {
    const g = grid({ A1: 'a', A2: '', A3: 'c' });
    expect(evaluateFormula('=TEXTJOIN("-", TRUE, A1, A2, A3)', g, 'D1')).toBe('a-c');
  });
  it('includes empty when flag off', () => {
    const g = grid({ A1: 'a', A2: '', A3: 'c' });
    expect(evaluateFormula('=TEXTJOIN("-", FALSE, A1, A2, A3)', g, 'D1')).toBe('a--c');
  });
});
