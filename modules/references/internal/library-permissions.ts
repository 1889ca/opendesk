/** Contract: contracts/references/rules.md */

import type { GrantStore } from '../../permissions/internal/grant-store.ts';
import { evaluate, ROLE_RANK, type Action } from '../../permissions/contract.ts';

const RESOURCE_TYPE = 'reference-library';

/**
 * Ensure a principal has at least one grant on a workspace's reference library.
 * If no grants exist for this principal, auto-creates an 'owner' grant.
 * This mirrors the dev-grant-helper pattern but is for production use:
 * the first user to access a workspace's library becomes its owner.
 */
export async function ensureLibraryGrant(
  grantStore: GrantStore,
  principalId: string,
  workspaceId: string,
): Promise<void> {
  const existing = await grantStore.findByPrincipalAndResource(
    principalId,
    workspaceId,
    RESOURCE_TYPE,
  );

  if (existing.length > 0) return;

  // Check if anyone owns this library already
  const allGrants = await grantStore.findByResource(workspaceId, RESOURCE_TYPE);
  const role = allGrants.length === 0 ? 'owner' as const : 'viewer' as const;

  await grantStore.create({
    principalId,
    resourceId: workspaceId,
    resourceType: RESOURCE_TYPE,
    role,
    grantedBy: principalId,
  });
}

/**
 * Check if a principal can perform the given action on a workspace's reference library.
 */
export async function checkLibraryAccess(
  grantStore: GrantStore,
  principalId: string,
  workspaceId: string,
  action: Action,
): Promise<boolean> {
  const grants = await grantStore.findByPrincipalAndResource(
    principalId,
    workspaceId,
    RESOURCE_TYPE,
  );

  if (grants.length === 0) return false;

  const stub = {
    id: principalId,
    actorType: 'human' as const,
    displayName: '',
    scopes: [],
  };

  const result = evaluate(stub, grants, {
    principalId,
    action,
    resourceId: workspaceId,
    resourceType: RESOURCE_TYPE,
  });

  return result.allowed;
}

/** The resource type constant for reference library grants. */
export { RESOURCE_TYPE as LIBRARY_RESOURCE_TYPE };
