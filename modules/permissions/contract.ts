/** Contract: contracts/permissions/rules.md */
import { z } from 'zod';
import type { Principal } from '../auth/contract.ts';

// --- Role Hierarchy ---

export const ROLES = ['owner', 'editor', 'commenter', 'viewer'] as const;

export const RoleSchema = z.enum(ROLES);

export type Role = z.infer<typeof RoleSchema>;

/** Numeric rank per role. Higher number = more privilege. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  editor: 3,
  commenter: 2,
  viewer: 1,
} as const;

// --- Action & Action-to-Role Mapping ---

export const ACTIONS = ['read', 'write', 'comment', 'delete', 'share', 'manage'] as const;

export const ActionSchema = z.enum(ACTIONS);

export type Action = z.infer<typeof ActionSchema>;

/** Minimum role required for each action. */
export const ACTION_MIN_ROLE: Record<Action, Role> = {
  manage: 'owner',
  share: 'owner',
  delete: 'editor',
  write: 'editor',
  comment: 'commenter',
  read: 'viewer',
} as const;

// --- Grant ---

export const GrantSchema = z.object({
  id: z.string().min(1),
  principalId: z.string().min(1),
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  role: RoleSchema,
  grantedBy: z.string().min(1),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type Grant = z.infer<typeof GrantSchema>;

export const GrantDefSchema = z.object({
  principalId: z.string().min(1),
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  role: RoleSchema,
  grantedBy: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export type GrantDef = z.infer<typeof GrantDefSchema>;

// --- PermissionQuery ---

export const PermissionQuerySchema = z.object({
  principalId: z.string().min(1),
  action: ActionSchema,
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
});

export type PermissionQuery = z.infer<typeof PermissionQuerySchema>;

// --- PermissionResult ---

export const PermissionResultSchema = z.object({
  allowed: z.boolean(),
  role: RoleSchema.nullable(),
  grant: GrantSchema.nullable(),
  reason: z.string().min(1),
});

export type PermissionResult = z.infer<typeof PermissionResultSchema>;

// --- Pure Evaluation ---

/**
 * Evaluate whether a principal is allowed to perform an action on a resource.
 *
 * This is a pure function: same inputs always produce the same output.
 * No I/O, no side effects, no async. Grant data must be loaded before calling.
 */
export function evaluate(
  _principal: Principal,
  grants: Grant[],
  query: PermissionQuery,
): PermissionResult {
  const now = new Date();

  // Filter to grants matching principal + resource, excluding expired ones
  const validGrants = grants.filter((g) => {
    if (g.principalId !== query.principalId) return false;
    if (g.resourceId !== query.resourceId) return false;
    if (g.resourceType !== query.resourceType) return false;
    if (g.expiresAt && new Date(g.expiresAt) <= now) return false;
    return true;
  });

  if (validGrants.length === 0) {
    return {
      allowed: false,
      role: null,
      grant: null,
      reason: `No valid grants for principal ${query.principalId} on ${query.resourceType}/${query.resourceId}`,
    };
  }

  // Find the highest-ranked grant
  const best = validGrants.reduce((a, b) =>
    ROLE_RANK[b.role] > ROLE_RANK[a.role] ? b : a
  );

  const minRole = ACTION_MIN_ROLE[query.action];

  if (ROLE_RANK[best.role] >= ROLE_RANK[minRole]) {
    return {
      allowed: true,
      role: best.role,
      grant: best,
      reason: `Role '${best.role}' satisfies minimum '${minRole}' for action '${query.action}'`,
    };
  }

  return {
    allowed: false,
    role: best.role,
    grant: best,
    reason: `Role '${best.role}' does not meet minimum '${minRole}' required for action '${query.action}'`,
  };
}
