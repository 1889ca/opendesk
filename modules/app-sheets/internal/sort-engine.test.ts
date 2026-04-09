/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { compareValues } from './sort-engine.ts';

describe('compareValues', () => {
  it('compares two numbers numerically', () => {
    expect(compareValues('10', '2')).toBeGreaterThan(0);
    expect(compareValues('2', '10')).toBeLessThan(0);
    expect(compareValues('5', '5')).toBe(0);
  });

  it('compares negative numbers', () => {
    expect(compareValues('-1', '1')).toBeLessThan(0);
    expect(compareValues('-5', '-3')).toBeLessThan(0);
  });

  it('compares decimal numbers', () => {
    expect(compareValues('1.5', '1.25')).toBeGreaterThan(0);
    expect(compareValues('0.1', '0.2')).toBeLessThan(0);
  });

  it('numbers sort before strings', () => {
    expect(compareValues('42', 'abc')).toBeLessThan(0);
    expect(compareValues('abc', '42')).toBeGreaterThan(0);
  });

  it('compares strings case-insensitively', () => {
    expect(compareValues('apple', 'Banana')).toBeLessThan(0);
    expect(compareValues('Banana', 'apple')).toBeGreaterThan(0);
    expect(compareValues('abc', 'ABC')).toBe(0);
  });

  it('empty strings sort last', () => {
    expect(compareValues('', 'anything')).toBeGreaterThan(0);
    expect(compareValues('anything', '')).toBeLessThan(0);
    expect(compareValues('', '')).toBe(0);
  });

  it('numbers before empty strings', () => {
    expect(compareValues('0', '')).toBeLessThan(0);
    expect(compareValues('', '0')).toBeGreaterThan(0);
  });
});
