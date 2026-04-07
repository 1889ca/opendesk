/** Contract: contracts/permissions/rules.md */

import type { Action } from '../contract.ts';
import { createInMemoryGrantStore, type GrantStore } from './grant-store.ts';
import { requirePermission, requireAuth } from './middleware.ts';

export type PermissionsModule = {
  grantStore: GrantStore;
  /** Middleware: require a specific permission on a document resource. */
  require: (action: Action) => ReturnType<typeof requirePermission>;
  /** Middleware: require authentication only (no resource-level check). */
  requireAuth: ReturnType<typeof requireAuth>;
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
  };
}
