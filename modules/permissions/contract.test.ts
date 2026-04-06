/** Contract: contracts/permissions/rules.md — Verification tests */
import { describe, it, expect } from 'vitest';
import { evaluate, ROLE_RANK, ACTION_MIN_ROLE, type Grant, type PermissionQuery } from './contract.ts';
import type { Principal } from '../auth/contract.ts';

const principal: Principal = {
  id: 'user-1',
  actorType: 'human',
  displayName: 'Alice',
  scopes: [],
};

function makeGrant(role: Grant['role'], overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'grant-1',
    principalId: 'user-1',
    resourceId: 'doc-1',
    resourceType: 'document',
    role,
    grantedBy: 'admin',
    grantedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeQuery(action: PermissionQuery['action']): PermissionQuery {
  return {
    principalId: 'user-1',
    action,
    resourceId: 'doc-1',
    resourceType: 'document',
  };
}

describe('Role hierarchy', () => {
  it('owner > editor > commenter > viewer', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeGreaterThan(ROLE_RANK.commenter);
    expect(ROLE_RANK.commenter).toBeGreaterThan(ROLE_RANK.viewer);
  });
});

describe('evaluate()', () => {
  it('allows owner to do anything', () => {
    const grants = [makeGrant('owner')];
    for (const action of ['read', 'write', 'comment', 'delete', 'share', 'manage'] as const) {
      const result = evaluate(principal, grants, makeQuery(action));
      expect(result.allowed).toBe(true);
    }
  });

  it('allows viewer to read', () => {
    const grants = [makeGrant('viewer')];
    expect(evaluate(principal, grants, makeQuery('read')).allowed).toBe(true);
  });

  it('denies viewer from writing', () => {
    const grants = [makeGrant('viewer')];
    expect(evaluate(principal, grants, makeQuery('write')).allowed).toBe(false);
  });

  it('allows editor to write and delete', () => {
    const grants = [makeGrant('editor')];
    expect(evaluate(principal, grants, makeQuery('write')).allowed).toBe(true);
    expect(evaluate(principal, grants, makeQuery('delete')).allowed).toBe(true);
  });

  it('denies editor from sharing', () => {
    const grants = [makeGrant('editor')];
    expect(evaluate(principal, grants, makeQuery('share')).allowed).toBe(false);
  });

  it('allows commenter to comment but not write', () => {
    const grants = [makeGrant('commenter')];
    expect(evaluate(principal, grants, makeQuery('comment')).allowed).toBe(true);
    expect(evaluate(principal, grants, makeQuery('write')).allowed).toBe(false);
  });

  it('denies when no grants exist', () => {
    const result = evaluate(principal, [], makeQuery('read'));
    expect(result.allowed).toBe(false);
    expect(result.role).toBeNull();
    expect(result.grant).toBeNull();
  });

  it('uses highest-ranked grant when multiple exist', () => {
    const grants = [makeGrant('viewer'), makeGrant('editor', { id: 'grant-2' })];
    const result = evaluate(principal, grants, makeQuery('write'));
    expect(result.allowed).toBe(true);
    expect(result.role).toBe('editor');
  });

  it('ignores expired grants', () => {
    const expired = makeGrant('owner', {
      expiresAt: new Date(Date.now() - 60000).toISOString(),
    });
    const result = evaluate(principal, [expired], makeQuery('read'));
    expect(result.allowed).toBe(false);
  });

  it('accepts non-expired grants', () => {
    const future = makeGrant('editor', {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const result = evaluate(principal, [future], makeQuery('write'));
    expect(result.allowed).toBe(true);
  });

  it('ignores grants for other principals', () => {
    const otherGrant = makeGrant('owner', { principalId: 'user-2' });
    const result = evaluate(principal, [otherGrant], makeQuery('read'));
    expect(result.allowed).toBe(false);
  });

  it('ignores grants for other resources', () => {
    const otherGrant = makeGrant('owner', { resourceId: 'doc-2' });
    const result = evaluate(principal, [otherGrant], makeQuery('read'));
    expect(result.allowed).toBe(false);
  });

  it('always returns a reason string', () => {
    const allowed = evaluate(principal, [makeGrant('owner')], makeQuery('read'));
    expect(allowed.reason).toBeTruthy();

    const denied = evaluate(principal, [], makeQuery('read'));
    expect(denied.reason).toBeTruthy();
  });

  it('treats agent principals the same as human principals', () => {
    const agentPrincipal: Principal = { ...principal, actorType: 'agent' };
    const grants = [makeGrant('editor')];
    const result = evaluate(agentPrincipal, grants, makeQuery('write'));
    expect(result.allowed).toBe(true);
  });
});

describe('ACTION_MIN_ROLE mapping', () => {
  it('maps every action to a valid role', () => {
    for (const [action, role] of Object.entries(ACTION_MIN_ROLE)) {
      expect(ROLE_RANK[role]).toBeDefined();
      expect(action).toBeTruthy();
    }
  });
});
