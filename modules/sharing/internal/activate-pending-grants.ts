/** Contract: contracts/sharing/rules.md */

import { createLogger } from '../../logger/index.ts';
import { ROLE_RANK, type GrantStore, type Role } from '../../permissions/index.ts';
import type { PendingGrantStore } from './pending-grant-store.ts';

const log = createLogger('sharing:activate');

/**
 * Security: canonicalize an email address for comparison.
 *
 * Lowercasing prevents case-sensitivity attacks (e.g. "Victim@example.com"
 * hijacking an invite sent to "victim@example.com"). Trimming removes
 * accidental whitespace from form inputs or IdP claims.
 */
function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Activate all pending grants for a given email address.
 *
 * SECURITY — two invariants enforced here:
 *
 * 1. (Issue #508) emailVerified MUST be true before activation.
 *    An attacker who registers victim@example.com with an unverified-email
 *    auth provider must not inherit every pending invite sent to that address.
 *    Callers pass `emailVerified` from the IdP's `email_verified` claim
 *    (populated by createOidcVerifier from the JWT). If false or absent the
 *    function returns 0 immediately without touching any grants.
 *
 * 2. (Issue #509) TOCTOU: grantor role is re-resolved at activation time.
 *    The role-ceiling check in routes-invite.ts happens at invite creation,
 *    but the grant is only written here, at acceptance. If the grantor was
 *    demoted or fully revoked in the intervening time the invitee would
 *    otherwise receive a role the grantor no longer holds.  We clamp the
 *    granted role to the grantor's current best role, and skip (do not
 *    activate) any grant whose grantor has been fully revoked.
 *
 * TODO (post-MVP, tracking Issue #508): switch to signed-link redemption
 * where the grantId is embedded in the invite token so activation is
 * impossible without the original token.  This removes the email-matching
 * surface entirely.
 *
 * TODO (DB migration required, tracking Issue #508): add a partial unique
 * index on pending_grants(doc_id, grantee_email) WHERE status = 'pending'
 * to prevent duplicate invites from stacking at the database level.
 * (migrations/ is a restricted zone; needs human maintainer sign-off.)
 *
 * @param userId        - the authenticated user's id
 * @param email         - the email address from the IdP token
 * @param emailVerified - whether the IdP has verified ownership of the email
 * @param pendingGrantStore
 * @param grantStore
 */
export async function activatePendingGrants(
  userId: string,
  email: string,
  emailVerified: boolean,
  pendingGrantStore: PendingGrantStore,
  grantStore: GrantStore,
): Promise<number> {
  // Issue #508: refuse to activate if the email is unverified.
  if (!emailVerified) {
    log.warn('activatePendingGrants skipped: email not verified by IdP', {
      userId,
      email,
    });
    return 0;
  }

  // Issue #508: canonicalize so "Victim@example.com" matches "victim@example.com".
  const canonEmail = canonicalizeEmail(email);

  const pending = await pendingGrantStore.findPendingByEmail(canonEmail);
  if (pending.length === 0) return 0;

  let activated = 0;

  for (const grant of pending) {
    try {
      // Issue #509: re-resolve the grantor's current role at activation time.
      // The role ceiling was checked at invite creation, but the grantor's
      // role may have changed (demotion or full revocation) since then.
      const grantorGrants = await grantStore.findByPrincipalAndResource(
        grant.grantorId,
        grant.docId,
        'document',
      );

      const grantorBestRank = grantorGrants.reduce(
        (max, g) => Math.max(max, ROLE_RANK[g.role as Role] ?? 0),
        0,
      );

      // If grantor has been fully revoked, drop this pending grant rather
      // than activating it with an illegitimate role.
      if (grantorBestRank === 0) {
        log.warn('Skipping pending grant: grantor has been fully revoked', {
          grantId: grant.id,
          grantorId: grant.grantorId,
          docId: grant.docId,
        });
        continue;
      }

      // Clamp the grant role to the grantor's current best role.
      const pendingRoleRank = ROLE_RANK[grant.role as Role] ?? 0;
      const effectiveRole =
        pendingRoleRank <= grantorBestRank
          ? (grant.role as Role)
          : grantorGrants.reduce(
              (best, g) =>
                ROLE_RANK[g.role as Role] > ROLE_RANK[best] ? (g.role as Role) : best,
              'viewer' as Role,
            );

      // 1. Transition pending grant -> active
      await pendingGrantStore.activateGrant(grant.id, userId);

      // 2. Write a live grant to the permissions store so access is
      //    enforced immediately without reloading the pending grant.
      await grantStore.create({
        principalId: userId,
        resourceId: grant.docId,
        resourceType: 'document',
        role: effectiveRole,
        grantedBy: grant.grantorId,
      });

      activated++;
    } catch (err) {
      // Log and continue — one failed activation should not block others.
      log.warn('Failed to activate pending grant', {
        grantId: grant.id,
        userId,
        email: canonEmail,
        err,
      });
    }
  }

  if (activated > 0) {
    log.info('Activated pending grants on authentication', {
      userId,
      email: canonEmail,
      count: activated,
    });
  }

  return activated;
}
