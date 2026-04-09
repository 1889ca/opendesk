/** Contract: contracts/workflow/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluateCondition } from './condition-evaluator.ts';
import type { ConditionOperator } from '../contract.ts';

const operatorArb = fc.constantFrom<ConditionOperator>(
  'equals', 'not_equals', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'greater_than', 'less_than',
  'includes', 'not_includes',
);

describe('workflow condition-evaluator property tests', () => {
  it('equals and not_equals are always complementary', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (fieldVal: string, testVal: string) => {
          const ctx = { field: fieldVal };
          const eq = evaluateCondition('field', 'equals', testVal, ctx);
          const neq = evaluateCondition('field', 'not_equals', testVal, ctx);
          expect(eq).not.toBe(neq);
        },
      ),
    );
  });

  it('contains and not_contains are always complementary', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (fieldVal: string, testVal: string) => {
          const ctx = { field: fieldVal };
          const c = evaluateCondition('field', 'contains', testVal, ctx);
          const nc = evaluateCondition('field', 'not_contains', testVal, ctx);
          expect(c).not.toBe(nc);
        },
      ),
    );
  });

  it('includes and not_includes are complementary for arrays', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        fc.string(),
        (arr: string[], testVal: string) => {
          const ctx = { field: arr };
          const inc = evaluateCondition('field', 'includes', testVal, ctx);
          const ninc = evaluateCondition('field', 'not_includes', testVal, ctx);
          expect(inc).not.toBe(ninc);
        },
      ),
    );
  });

  it('a value always equals itself', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (val: string) => {
          const ctx = { field: val };
          expect(evaluateCondition('field', 'equals', val, ctx)).toBe(true);
        },
      ),
    );
  });

  it('a string always contains itself', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (val: string) => {
          const ctx = { field: val };
          expect(evaluateCondition('field', 'contains', val, ctx)).toBe(true);
        },
      ),
    );
  });

  it('a string always starts_with its own prefix', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (val: string) => {
          const prefix = val.slice(0, Math.ceil(val.length / 2));
          const ctx = { field: val };
          expect(evaluateCondition('field', 'starts_with', prefix, ctx)).toBe(true);
        },
      ),
    );
  });

  it('a string always ends_with its own suffix', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (val: string) => {
          const suffix = val.slice(Math.floor(val.length / 2));
          const ctx = { field: val };
          expect(evaluateCondition('field', 'ends_with', suffix, ctx)).toBe(true);
        },
      ),
    );
  });

  it('greater_than is asymmetric: if a > b then NOT b > a (for distinct values)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (a: number, b: number) => {
          fc.pre(a !== b);
          const ctxA = { field: a };
          const ctxB = { field: b };
          const aGtB = evaluateCondition('field', 'greater_than', String(b), ctxA);
          const bGtA = evaluateCondition('field', 'greater_than', String(a), ctxB);
          expect(aGtB).not.toBe(bGtA);
        },
      ),
    );
  });

  it('dot-path resolution works for nested fields', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (val: string) => {
          const ctx = { deep: { nested: { value: val } } };
          expect(evaluateCondition('deep.nested.value', 'equals', val, ctx)).toBe(true);
        },
      ),
    );
  });

  it('missing field resolves to empty string for string operators', () => {
    fc.assert(
      fc.property(
        // Use prefixed field names to avoid collisions with Object prototype properties
        fc.string({ minLength: 1 }).map((s) => `_test_${s}`),
        (field: string) => {
          const ctx = {};
          expect(evaluateCondition(field, 'equals', '', ctx)).toBe(true);
          expect(evaluateCondition(field, 'not_equals', '', ctx)).toBe(false);
        },
      ),
    );
  });
});
