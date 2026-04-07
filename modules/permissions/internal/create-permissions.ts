/** Contract: contracts/permissions/rules.md */

import { evaluate, type Action } from '../contract.ts';
import { createInMemoryGrantStore, type GrantStore } from './grant-store.ts';
import { requirePermission, requireAuth } from './middleware.ts';

export type PermissionsModule = {
  grantStore: GrantStore;
  /** Middleware: require a specific permission on a document resource. */
  require: (action: Action) => ReturnType<typeof requirePermission>;
  /** Middleware: require authentication only (no resource-level check). */
  requireAuth: ReturnType<typeof requireAuth>;
  /** Programmatic check: does this principal have the given action on a resource? */
  checkPermission: (principalId: string, resourceId: string, action: Action) => Promise<boolean>;
};

export type PermissionsDependencies = {
  grantStore?: GrantStore;
};

/**
 * Factory function that wires up the permissions module.
 * Call once at application startup.
 */
export function createPermissions(deps: PermissionsDependencies = {}): PermissionsModule {
  const grantStore = deps.grantStore ?? createInMemoryGrantStore();

  return {
    grantStore,
    require: (action: Action) =>
      requirePermission(action, { grantStore, resourceType: 'document' }),
    requireAuth: requireAuth(),
    async checkPermission(principalId: string, resourceId: string, action: Action) {
      const grants = await grantStore.findByPrincipalAndResource(
        principalId,
        resourceId,
        'document',
      );
      const stub = { id: principalId, actorType: 'human' as const, displayName: '', scopes: [] };
      const result = evaluate(stub, grants, {
        principalId,
        action,
        resourceId,
        resourceType: 'document',
      });
      return result.allowed;
    },
  };
}
