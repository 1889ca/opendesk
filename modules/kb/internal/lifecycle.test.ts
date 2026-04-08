/** Contract: contracts/kb/rules.md */
import { describe, it, expect } from 'vitest';
import { validateTransition, isPubliclyAvailable } from './lifecycle.ts';
import type { KbEntryStatus } from '../contract.ts';

describe('validateTransition', () => {
  const validCases: [KbEntryStatus, KbEntryStatus][] = [
    ['draft', 'reviewed'],
    ['reviewed', 'published'],
    ['reviewed', 'draft'],
    ['published', 'deprecated'],
  ];

  for (const [from, to] of validCases) {
    it(`allows ${from} -> ${to}`, () => {
      const result = validateTransition(from, to);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.from).toBe(from);
        expect(result.to).toBe(to);
      }
    });
  }

  const invalidCases: [KbEntryStatus, KbEntryStatus][] = [
    ['draft', 'published'],
    ['draft', 'deprecated'],
    ['reviewed', 'deprecated'],
    ['published', 'draft'],
    ['published', 'reviewed'],
    ['deprecated', 'draft'],
    ['deprecated', 'reviewed'],
    ['deprecated', 'published'],
  ];

  for (const [from, to] of invalidCases) {
    it(`rejects ${from} -> ${to}`, () => {
      const result = validateTransition(from, to);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INVALID_TRANSITION');
      }
    });
  }
});

describe('isPubliclyAvailable', () => {
  it('returns true for published', () => {
    expect(isPubliclyAvailable('published')).toBe(true);
  });

  it('returns false for draft', () => {
    expect(isPubliclyAvailable('draft')).toBe(false);
  });

  it('returns false for reviewed', () => {
    expect(isPubliclyAvailable('reviewed')).toBe(false);
  });

  it('returns false for deprecated', () => {
    expect(isPubliclyAvailable('deprecated')).toBe(false);
  });
});
