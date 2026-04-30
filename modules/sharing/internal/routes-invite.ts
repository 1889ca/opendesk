/** Contract: contracts/sharing/rules.md */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { GrantRoleSchema } from '../contract.ts';
import { ROLE_RANK, type GrantStore, type Role, type PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { EventType, type EventBus } from '../../events/index.ts';
import { createLogger } from '../../logger/index.ts';
import type { PendingGrantStore } from './pending-grant-store.ts';

const log = createLogger('sharing:invite');

const InviteBodySchema = z.object({
  email: z.string().email({ message: 'email must be a valid email address' }),
  role: GrantRoleSchema,
});

export type InviteRoutesOptions = {
  pendingGrantStore: PendingGrantStore;
  grantStore: GrantStore;
  permissions: PermissionsModule;
  /** Optional — when omitted, the InviteCreated event is not emitted. */
  eventBus?: EventBus | null;
};

/**
 * Add POST /api/documents/:id/invite to a router.
 *
 * Creates a pending grant for the given email address and emits an
 * InviteCreated event (fire-and-forget) so the notification system
 * can send the invite email. The sharing module never sends email
 * directly — that is the notification system's responsibility.
 *
 * The grant activates when the invitee authenticates. See
 * activatePendingGrants() in activate-pending-grants.ts.
 */
export function addInviteRoute(router: Router, opts: InviteRoutesOptions): void {
  const { pendingGrantStore, grantStore, permissions, eventBus } = opts;

  router.post(
    '/api/documents/:id/invite',
    permissions.require('write'),
    asyncHandler(async (req, res) => {
      const docId = String(req.params.id);
      const grantorId = req.principal!.id;

      const bodyResult = InviteBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'invalid_body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const { email, role } = bodyResult.data;

      // Enforce role ceiling: grantor cannot invite at a higher role than their own.
      const grantorGrants = await grantStore.findByPrincipalAndResource(
        grantorId,
        docId,
        'document',
      );
      const bestRank = grantorGrants.reduce(
        (max, g) => Math.max(max, ROLE_RANK[g.role as Role] ?? 0),
        0,
      );
      if (bestRank < (ROLE_RANK[role as Role] ?? 0)) {
        res.status(403).json({ error: 'cannot_grant_higher_than_own_role' });
        return;
      }

      const grant = await pendingGrantStore.createPending({
        docId,
        grantorId,
        email,
        role,
      });

      // Fire-and-forget: emit InviteCreated so the notification system
      // can send the invite email. The sharing module MUST NOT send email
      // directly (contract boundary rule).
      if (eventBus) {
        const event = {
          id: randomUUID(),
          type: EventType.InviteCreated,
          aggregateId: docId,
          actorId: grantorId,
          actorType: 'system' as const,
          occurredAt: new Date().toISOString(),
          // Carry invite metadata in revisionId (reusing the thin event shape).
          // A richer payload belongs in the outbox payload field if needed later.
          revisionId: grant.id,
        };
        eventBus.emit(event, null).catch((err) => {
          log.warn('InviteCreated event emission failed (non-fatal)', { err });
        });
      }

      res.status(201).json({
        id: grant.id,
        docId: grant.docId,
        grantorId: grant.grantorId,
        granteeEmail: grant.granteeEmail,
        role: grant.role,
        status: grant.status,
        createdAt: grant.createdAt,
      });
    }),
  );
}
