/** Contract: contracts/sharing/rules.md */

import { createLogger } from '../../logger/index.ts';
import type { GrantStore, Role } from '../../permissions/index.ts';
import type { PendingGrantStore } from './pending-grant-store.ts';

const log = createLogger('sharing:activate');

/**
 * Activate all pending grants for a given email address.
 *
 * Call this after a user successfully authenticates and their email address
 * is confirmed. Any pending invite grants that match the email will
 * transition from 'pending' to 'active', and a corresponding entry will be
 * written to the permissions GrantStore so the user gains access immediately.
 *
 * This is a pure side-effect function: it returns the count of grants
 * activated so callers can log or audit the operation.
 */
export async function activatePendingGrants(
  userId: string,
  email: string,
  pendingGrantStore: PendingGrantStore,
  grantStore: GrantStore,
): Promise<number> {
  const pending = await pendingGrantStore.findPendingByEmail(email);
  if (pending.length === 0) return 0;

  let activated = 0;

  for (const grant of pending) {
    try {
      // 1. Transition pending grant -> active
      await pendingGrantStore.activateGrant(grant.id, userId);

      // 2. Write a live grant to the permissions store so access is
      //    enforced immediately without reloading the pending grant.
      await grantStore.create({
        principalId: userId,
        resourceId: grant.docId,
        resourceType: 'document',
        role: grant.role as Role,
        grantedBy: grant.grantorId,
      });

      activated++;
    } catch (err) {
      // Log and continue — one failed activation should not block others.
      log.warn('Failed to activate pending grant', {
        grantId: grant.id,
        userId,
        email,
        err,
      });
    }
  }

  if (activated > 0) {
    log.info('Activated pending grants on authentication', {
      userId,
      email,
      count: activated,
    });
  }

  return activated;
}
