/** Contract: contracts/workflow/rules.md */
import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './condition-evaluator.ts';

describe('evaluateCondition', () => {
  const ctx = {
    document: {
      title: 'Draft Report Q4',
      tags: ['confidential', 'finance'],
      size: 1024,
    },
    user: {
      role: 'admin',
      name: 'Alice',
    },
  };

  it('equals: matches exact string', () => {
    expect(evaluateCondition('user.role', 'equals', 'admin', ctx)).toBe(true);
    expect(evaluateCondition('user.role', 'equals', 'viewer', ctx)).toBe(false);
  });

  it('not_equals: inverted match', () => {
    expect(evaluateCondition('user.role', 'not_equals', 'viewer', ctx)).toBe(true);
    expect(evaluateCondition('user.role', 'not_equals', 'admin', ctx)).toBe(false);
  });

  it('contains: substring match', () => {
    expect(evaluateCondition('document.title', 'contains', 'Draft', ctx)).toBe(true);
    expect(evaluateCondition('document.title', 'contains', 'Final', ctx)).toBe(false);
  });

  it('not_contains: inverted substring', () => {
    expect(evaluateCondition('document.title', 'not_contains', 'Final', ctx)).toBe(true);
    expect(evaluateCondition('document.title', 'not_contains', 'Draft', ctx)).toBe(false);
  });

  it('starts_with / ends_with', () => {
    expect(evaluateCondition('document.title', 'starts_with', 'Draft', ctx)).toBe(true);
    expect(evaluateCondition('document.title', 'ends_with', 'Q4', ctx)).toBe(true);
    expect(evaluateCondition('document.title', 'starts_with', 'Report', ctx)).toBe(false);
  });

  it('greater_than / less_than: numeric comparison', () => {
    expect(evaluateCondition('document.size', 'greater_than', '500', ctx)).toBe(true);
    expect(evaluateCondition('document.size', 'less_than', '500', ctx)).toBe(false);
    expect(evaluateCondition('document.size', 'less_than', '2000', ctx)).toBe(true);
  });

  it('includes: array membership check', () => {
    expect(evaluateCondition('document.tags', 'includes', 'confidential', ctx)).toBe(true);
    expect(evaluateCondition('document.tags', 'includes', 'public', ctx)).toBe(false);
  });

  it('not_includes: inverted array membership', () => {
    expect(evaluateCondition('document.tags', 'not_includes', 'public', ctx)).toBe(true);
    expect(evaluateCondition('document.tags', 'not_includes', 'confidential', ctx)).toBe(false);
  });

  it('handles missing fields gracefully', () => {
    expect(evaluateCondition('nonexistent.path', 'equals', '', ctx)).toBe(true);
    expect(evaluateCondition('nonexistent.path', 'contains', 'x', ctx)).toBe(false);
  });

  it('handles null context values', () => {
    const nullCtx = { value: null };
    expect(evaluateCondition('value', 'equals', '', nullCtx)).toBe(true);
  });
});
