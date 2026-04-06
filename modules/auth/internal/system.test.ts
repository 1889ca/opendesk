/** Contract: contracts/auth/rules.md */

import { describe, it, expect } from 'vitest';
import { createSystemPrincipal } from './system.ts';

describe('createSystemPrincipal', () => {
  it('creates a principal with actorType "system"', () => {
    const p = createSystemPrincipal();
    expect(p.actorType).toBe('system');
    expect(p.id).toBe('system');
    expect(p.displayName).toBe('System');
    expect(p.scopes).toContain('*');
  });

  it('accepts custom id and scopes', () => {
    const p = createSystemPrincipal('cron-job', ['documents.read']);
    expect(p.id).toBe('cron-job');
    expect(p.actorType).toBe('system');
    expect(p.scopes).toEqual(['documents.read']);
  });

  it('principal is frozen (immutable)', () => {
    const p = createSystemPrincipal();
    expect(Object.isFrozen(p)).toBe(true);
  });
});
