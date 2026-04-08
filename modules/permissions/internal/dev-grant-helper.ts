/** Contract: contracts/permissions/rules.md */

import type { GrantStore } from './grant-store.ts';

/**
 * Ensures a dev user has an owner grant on the given resource.
 * Checks for an existing grant first to avoid duplicates.
 *
 * This is ONLY used in dev mode (AUTH_MODE=dev) so that permission
 * evaluation logic is exercised even during development, instead of
 * being silently bypassed.
 */
export async function ensureDevGrant(
  grantStore: GrantStore,
  principalId: string,
  resourceId: string,
  resourceType: string,
): Promise<void> {
  const existing = await grantStore.findByPrincipalAndResource(
    principalId,
    resourceId,
    resourceType,
  );

  if (existing.length > 0) {
    return;
  }

  await grantStore.create({
    principalId,
    resourceId,
    resourceType,
    role: 'owner',
    grantedBy: 'dev-auto',
  });
}
