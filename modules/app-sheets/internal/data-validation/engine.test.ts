/** Contract: contracts/app-sheets/data-validation.md */
import { describe, it, expect } from 'vitest';
import { validate } from './engine.ts';
import type { ValidationRule } from './types.ts';

function makeRule(partial: Partial<ValidationRule>): ValidationRule {
  return {
    id: 'test-1',
    type: 'list',
    range: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    errorStyle: 'reject',
    allowBlank: false,
    ...partial,
  };
}

describe('validate — list', () => {
  const rule = makeRule({
    type: 'list',
    listItems: ['Apple', 'Banana', 'Cherry'],
  });

  it('accepts listed value', () => {
    expect(validate(rule, 'Apple').valid).toBe(true);
  });

  it('accepts case-insensitive match', () => {
    expect(validate(rule, 'apple').valid).toBe(true);
    expect(validate(rule, 'BANANA').valid).toBe(true);
  });

  it('rejects unlisted value', () => {
    const r = validate(rule, 'Mango');
    expect(r.valid).toBe(false);
    expect(r.errorStyle).toBe('reject');
  });

  it('rejects blank when allowBlank is false', () => {
    expect(validate(rule, '').valid).toBe(false);
  });

  it('allows blank when allowBlank is true', () => {
    const r2 = makeRule({ ...rule, allowBlank: true });
    expect(validate(r2, '').valid).toBe(true);
  });
});

describe('validate — number', () => {
  const rule = makeRule({
    type: 'number',
    operator: 'between',
    value1: '1',
    value2: '100',
  });

  it('accepts number in range', () => {
    expect(validate(rule, '50').valid).toBe(true);
  });

  it('accepts boundary values', () => {
    expect(validate(rule, '1').valid).toBe(true);
    expect(validate(rule, '100').valid).toBe(true);
  });

  it('rejects out of range', () => {
    expect(validate(rule, '0').valid).toBe(false);
    expect(validate(rule, '101').valid).toBe(false);
  });

  it('rejects non-numeric text', () => {
    expect(validate(rule, 'abc').valid).toBe(false);
  });

  it('greater operator works', () => {
    const r = makeRule({ type: 'number', operator: 'greater', value1: '10' });
    expect(validate(r, '11').valid).toBe(true);
    expect(validate(r, '10').valid).toBe(false);
    expect(validate(r, '9').valid).toBe(false);
  });

  it('less-equal operator works', () => {
    const r = makeRule({ type: 'number', operator: 'less-equal', value1: '5' });
    expect(validate(r, '5').valid).toBe(true);
    expect(validate(r, '4').valid).toBe(true);
    expect(validate(r, '6').valid).toBe(false);
  });

  it('not-between operator works', () => {
    const r = makeRule({
      type: 'number', operator: 'not-between', value1: '10', value2: '20',
    });
    expect(validate(r, '5').valid).toBe(true);
    expect(validate(r, '25').valid).toBe(true);
    expect(validate(r, '15').valid).toBe(false);
  });
});

describe('validate — integer', () => {
  const rule = makeRule({
    type: 'integer',
    operator: 'between',
    value1: '1',
    value2: '10',
  });

  it('accepts integer in range', () => {
    expect(validate(rule, '5').valid).toBe(true);
  });

  it('rejects decimal', () => {
    expect(validate(rule, '5.5').valid).toBe(false);
  });

  it('rejects non-numeric', () => {
    expect(validate(rule, 'xyz').valid).toBe(false);
  });
});

describe('validate — text-length', () => {
  const rule = makeRule({
    type: 'text-length',
    operator: 'between',
    value1: '3',
    value2: '10',
  });

  it('accepts text within length range', () => {
    expect(validate(rule, 'hello').valid).toBe(true);
  });

  it('rejects too short', () => {
    expect(validate(rule, 'ab').valid).toBe(false);
  });

  it('rejects too long', () => {
    expect(validate(rule, 'a very long string').valid).toBe(false);
  });
});

describe('validate — date', () => {
  const rule = makeRule({
    type: 'date',
    operator: 'between',
    value1: '2024-01-01',
    value2: '2024-12-31',
  });

  it('accepts date in range', () => {
    expect(validate(rule, '2024-06-15').valid).toBe(true);
  });

  it('rejects date out of range', () => {
    expect(validate(rule, '2023-12-31').valid).toBe(false);
  });

  it('rejects invalid date string', () => {
    expect(validate(rule, 'not-a-date').valid).toBe(false);
  });
});

describe('validate — error messages', () => {
  it('returns custom error message', () => {
    const rule = makeRule({
      type: 'list',
      listItems: ['A'],
      errorMessage: 'Pick from the list!',
    });
    const r = validate(rule, 'Z');
    expect(r.message).toBe('Pick from the list!');
  });

  it('returns default message when no custom message', () => {
    const rule = makeRule({ type: 'list', listItems: ['A'] });
    const r = validate(rule, 'Z');
    expect(r.message).toContain('allowed options');
  });
});
