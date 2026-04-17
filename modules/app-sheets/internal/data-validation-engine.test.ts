/** Contract: contracts/app-sheets/rules.md */
import { describe, it, expect } from 'vitest';
import { validate } from './data-validation-engine.ts';
import type { ValidationRule, ValidationRange } from './data-validation-rules.ts';

const range: ValidationRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };

function rule(overrides: Partial<ValidationRule>): ValidationRule {
  return {
    id: 'test',
    type: 'number',
    range,
    allowBlank: false,
    onInvalid: 'reject',
    ...overrides,
  };
}

describe('data-validation-engine', () => {
  describe('list validation', () => {
    const r = rule({ type: 'list', items: ['A', 'B', 'C'] });

    it('accepts a listed value', () => {
      expect(validate(r, 'A')).toEqual({ valid: true });
    });

    it('rejects an unlisted value', () => {
      const res = validate(r, 'D');
      expect(res.valid).toBe(false);
    });

    it('rejects empty when allowBlank is false', () => {
      expect(validate(r, '').valid).toBe(false);
    });

    it('accepts empty when allowBlank is true', () => {
      const r2 = rule({ type: 'list', items: ['A'], allowBlank: true });
      expect(validate(r2, '')).toEqual({ valid: true });
    });
  });

  describe('number validation', () => {
    it('rejects non-numeric input', () => {
      const r = rule({ type: 'number', condition: 'greater', value1: '10' });
      expect(validate(r, 'abc').valid).toBe(false);
    });

    it('validates greater than', () => {
      const r = rule({ type: 'number', condition: 'greater', value1: '10' });
      expect(validate(r, '15').valid).toBe(true);
      expect(validate(r, '5').valid).toBe(false);
    });

    it('validates less than', () => {
      const r = rule({ type: 'number', condition: 'less', value1: '10' });
      expect(validate(r, '5').valid).toBe(true);
      expect(validate(r, '15').valid).toBe(false);
    });

    it('validates between', () => {
      const r = rule({ type: 'number', condition: 'between', value1: '1', value2: '100' });
      expect(validate(r, '50').valid).toBe(true);
      expect(validate(r, '0').valid).toBe(false);
      expect(validate(r, '101').valid).toBe(false);
    });

    it('validates not between', () => {
      const r = rule({ type: 'number', condition: 'not-between', value1: '1', value2: '100' });
      expect(validate(r, '0').valid).toBe(true);
      expect(validate(r, '50').valid).toBe(false);
    });

    it('validates equal', () => {
      const r = rule({ type: 'number', condition: 'equal', value1: '42' });
      expect(validate(r, '42').valid).toBe(true);
      expect(validate(r, '43').valid).toBe(false);
    });

    it('validates not equal', () => {
      const r = rule({ type: 'number', condition: 'not-equal', value1: '42' });
      expect(validate(r, '43').valid).toBe(true);
      expect(validate(r, '42').valid).toBe(false);
    });

    it('validates greater or equal', () => {
      const r = rule({ type: 'number', condition: 'greater-equal', value1: '10' });
      expect(validate(r, '10').valid).toBe(true);
      expect(validate(r, '9').valid).toBe(false);
    });

    it('validates less or equal', () => {
      const r = rule({ type: 'number', condition: 'less-equal', value1: '10' });
      expect(validate(r, '10').valid).toBe(true);
      expect(validate(r, '11').valid).toBe(false);
    });
  });

  describe('integer validation', () => {
    it('rejects non-integer', () => {
      const r = rule({ type: 'integer', condition: 'greater', value1: '0' });
      expect(validate(r, '3.5').valid).toBe(false);
    });

    it('accepts integer', () => {
      const r = rule({ type: 'integer', condition: 'greater', value1: '0' });
      expect(validate(r, '5').valid).toBe(true);
    });
  });

  describe('date validation', () => {
    it('rejects invalid date', () => {
      const r = rule({ type: 'date' });
      expect(validate(r, 'not-a-date').valid).toBe(false);
    });

    it('accepts valid date', () => {
      const r = rule({ type: 'date' });
      expect(validate(r, '2025-01-15').valid).toBe(true);
    });
  });

  describe('text length validation', () => {
    it('validates max length', () => {
      const r = rule({ type: 'text-length', condition: 'less-equal', value1: '5' });
      expect(validate(r, 'abc').valid).toBe(true);
      expect(validate(r, 'toolong').valid).toBe(false);
    });

    it('validates between length', () => {
      const r = rule({ type: 'text-length', condition: 'between', value1: '2', value2: '5' });
      expect(validate(r, 'ab').valid).toBe(true);
      expect(validate(r, 'a').valid).toBe(false);
    });
  });

  describe('custom regex validation', () => {
    it('validates against pattern', () => {
      const r = rule({ type: 'custom', value1: '^\\d{3}-\\d{4}$' });
      expect(validate(r, '123-4567').valid).toBe(true);
      expect(validate(r, 'abc').valid).toBe(false);
    });

    it('handles invalid regex gracefully', () => {
      const r = rule({ type: 'custom', value1: '[invalid' });
      expect(validate(r, 'test').valid).toBe(false);
    });
  });

  describe('allowBlank', () => {
    it('skips validation on empty when allowBlank is true', () => {
      const r = rule({ type: 'number', condition: 'greater', value1: '10', allowBlank: true });
      expect(validate(r, '').valid).toBe(true);
    });

    it('applies validation on empty when allowBlank is false', () => {
      const r = rule({ type: 'number', condition: 'greater', value1: '10', allowBlank: false });
      expect(validate(r, '').valid).toBe(false);
    });
  });
});
