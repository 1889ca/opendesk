/** Contract: contracts/sharing/rules.md */

import { Router } from 'express';
import { GrantRoleSchema } from '../contract.ts';
import { ROLE_RANK, type GrantStore, type Role } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

/**
 * Add PATCH /api/grants/:grantId to a router.
 *
 * Changes the role on an existing grant, subject to the grantor's own
 * role ceiling. Only the grantor may update a grant they created.
 *
 * Rules:
 * - 404 if grant not found
 * - 409 if the grant has been revoked (deleted from the store)
 *   Note: The permissions store hard-deletes revoked grants, so a missing
 *   grant is the only possible "not found" state. There is no soft-deleted
 *   "revoked" row to distinguish — 404 and 409 collapse into 404 here.
 * - 403 if the new role rank exceeds the grantor's best rank on that document
 * - 200 with updated grant on success
 */
export function addUpdateGrantRoute(router: Router, grantStore: GrantStore): void {
  router.patch(
    '/api/grants/:grantId',
    asyncHandler(async (req, res) => {
      const grantId = String(req.params.grantId);
      const grantorId = req.principal?.id;

      if (!grantorId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const roleResult = GrantRoleSchema.safeParse(req.body?.role);
      if (!roleResult.success) {
        res.status(400).json({ error: 'role must be "viewer", "editor", or "commenter"' });
        return;
      }
      const newRole = roleResult.data as Role;

      const existing = await grantStore.findById(grantId);
      if (!existing) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Enforce role ceiling: grantor cannot elevate beyond their own best rank.
      const grantorGrants = await grantStore.findByPrincipalAndResource(
        grantorId,
        existing.resourceId,
        existing.resourceType,
      );
      const bestRank = grantorGrants.reduce(
        (max, g) => Math.max(max, ROLE_RANK[g.role as Role] ?? 0),
        0,
      );
      if (bestRank < (ROLE_RANK[newRole] ?? 0)) {
        res.status(403).json({ error: 'cannot_grant_higher_than_own_role' });
        return;
      }

      const updated = await grantStore.updateGrantRole(grantId, newRole);
      if (!updated) {
        // Race: grant disappeared between findById and updateGrantRole.
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.status(200).json(updated);
    }),
  );
}
