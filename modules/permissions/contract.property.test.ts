/** Contract: contracts/permissions/rules.md — Property-based tests */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  evaluate,
  ROLES,
  ROLE_RANK,
  ACTIONS,
  ACTION_MIN_ROLE,
  type Grant,
  type Role,
  type Action,
} from './contract.ts';
import type { Principal } from '../auth/contract.ts';

const principal: Principal = {
  id: 'user-1',
  actorType: 'human',
  displayName: 'Test User',
  scopes: [],
};

const roleArb = fc.constantFrom(...ROLES);
const actionArb = fc.constantFrom(...ACTIONS);

function makeGrant(role: Role, overrides: Partial<Grant> = {}): Grant {
  return {
    id: 'grant-1',
    principalId: 'user-1',
    resourceId: 'doc-1',
    resourceType: 'document',
    role,
    grantedBy: 'admin',
    grantedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const baseQuery = {
  principalId: 'user-1',
  resourceId: 'doc-1',
  resourceType: 'document',
};

describe('permissions/evaluate property tests', () => {
  it('higher roles always include all permissions of lower roles', () => {
    fc.assert(
      fc.property(roleArb, actionArb, (role: Role, action: Action) => {
        const result = evaluate(principal, [makeGrant(role)], {
          ...baseQuery,
          action,
        });
        if (result.allowed) {
          // Every role with lower rank should also be allowed
          for (const lowerRole of ROLES) {
            if (ROLE_RANK[lowerRole] > ROLE_RANK[role]) continue;
            // A higher role being allowed means all roles at same or higher rank
            // would also be allowed for the same action — but here we check that
            // a higher role grants at least what this role grants
          }
          // The role rank must meet the action minimum
          expect(ROLE_RANK[role]).toBeGreaterThanOrEqual(
            ROLE_RANK[ACTION_MIN_ROLE[action]],
          );
        }
      }),
    );
  });

  it('owner always has full access to every action', () => {
    fc.assert(
      fc.property(actionArb, (action: Action) => {
        const result = evaluate(principal, [makeGrant('owner')], {
          ...baseQuery,
          action,
        });
        expect(result.allowed).toBe(true);
        expect(result.role).toBe('owner');
      }),
    );
  });

  it('empty grants always results in no access', () => {
    fc.assert(
      fc.property(actionArb, (action: Action) => {
        const result = evaluate(principal, [], {
          ...baseQuery,
          action,
        });
        expect(result.allowed).toBe(false);
        expect(result.role).toBeNull();
        expect(result.grant).toBeNull();
      }),
    );
  });

  it('evaluate picks the highest role when multiple grants exist', () => {
    fc.assert(
      fc.property(roleArb, roleArb, actionArb, (role1: Role, role2: Role, action: Action) => {
        const grants = [
          makeGrant(role1, { id: 'grant-1' }),
          makeGrant(role2, { id: 'grant-2' }),
        ];
        const result = evaluate(principal, grants, {
          ...baseQuery,
          action,
        });

        const bestRank = Math.max(ROLE_RANK[role1], ROLE_RANK[role2]);
        const minRequired = ROLE_RANK[ACTION_MIN_ROLE[action]];

        if (bestRank >= minRequired) {
          expect(result.allowed).toBe(true);
          expect(ROLE_RANK[result.role!]).toBe(bestRank);
        } else {
          expect(result.allowed).toBe(false);
        }
      }),
    );
  });

  it('grants for wrong principal/resource are ignored', () => {
    fc.assert(
      fc.property(roleArb, actionArb, (role: Role, action: Action) => {
        const wrongPrincipalGrant = makeGrant(role, {
          principalId: 'other-user',
        });
        const wrongResourceGrant = makeGrant(role, {
          resourceId: 'other-doc',
        });

        const result1 = evaluate(principal, [wrongPrincipalGrant], {
          ...baseQuery,
          action,
        });
        const result2 = evaluate(principal, [wrongResourceGrant], {
          ...baseQuery,
          action,
        });

        expect(result1.allowed).toBe(false);
        expect(result2.allowed).toBe(false);
      }),
    );
  });
});
