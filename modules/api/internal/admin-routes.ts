/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import {
  deleteDocument as defaultDeleteDocument,
} from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { CacheClient } from './redis.ts';
import { asyncHandler } from './async-handler.ts';

export type StorageFns = {
  deleteDocument: (id: string) => Promise<boolean>;
};

export type AdminRoutesOptions = {
  permissions: PermissionsModule;
  cache?: CacheClient;
  storage?: StorageFns;
};

/** Deletion receipt for a single resource. */
export interface DeletionEntry {
  type: 'document' | 'grant';
  id: string;
}

/** Full purge receipt returned by the user data purge endpoint. */
export interface PurgeReceipt {
  userId: string;
  action: 'delete' | 'transfer';
  transferTo?: string;
  deletedAt: string;
  deleted: DeletionEntry[];
  transferred: DeletionEntry[];
}

/**
 * Admin routes for user data management (GDPR-style purge).
 */
export function createAdminRoutes(opts: AdminRoutesOptions): Router {
  const router = Router();
  const { permissions, cache, storage } = opts;
  const { deleteDocument } = storage ?? { deleteDocument: defaultDeleteDocument };

  // DELETE /api/admin/users/:id/data — purge all user data
  router.delete(
    '/users/:id/data',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      if (req.principal?.id !== req.params.id) {
        res.status(403).json({ error: 'Can only purge your own data' });
        return;
      }

      const userId = String(req.params.id);
      const action = (req.query.action as string) || 'delete';
      const transferTo = req.query.transferTo as string | undefined;

      if (action !== 'delete' && action !== 'transfer') {
        res.status(400).json({
          error: 'action must be "delete" or "transfer"',
        });
        return;
      }

      if (action === 'transfer' && !transferTo) {
        res.status(400).json({
          error: 'transferTo is required when action is "transfer"',
        });
        return;
      }

      const receipt = await purgeUserData(
        userId,
        action,
        transferTo,
        permissions,
        cache,
        { deleteDocument },
      );

      res.json(receipt);
    }),
  );

  return router;
}

/**
 * Purge or transfer all data associated with a user.
 * - Finds all documents owned by the user
 * - Finds all permission grants for the user
 * - Deletes or transfers ownership based on action parameter
 */
export async function purgeUserData(
  userId: string,
  action: 'delete' | 'transfer',
  transferTo: string | undefined,
  permissions: PermissionsModule,
  cache?: CacheClient,
  storage?: StorageFns,
): Promise<PurgeReceipt> {
  const { deleteDocument } = storage ?? { deleteDocument: defaultDeleteDocument };
  const deleted: DeletionEntry[] = [];
  const transferred: DeletionEntry[] = [];

  // Find all grants for this user
  const grants = await permissions.grantStore.findByPrincipal(userId);

  // Identify documents owned by this user
  const ownedDocIds = grants
    .filter((g) => g.role === 'owner' && g.resourceType === 'document')
    .map((g) => g.resourceId);

  if (action === 'delete') {
    // Delete all owned documents
    for (const docId of ownedDocIds) {
      const wasDeleted = await deleteDocument(docId);
      if (wasDeleted) {
        deleted.push({ type: 'document', id: docId });
        // Clean up cache
        if (cache) {
          try {
            await cache.del(`doc:${docId}`, `yjs:${docId}`);
          } catch {
            // Best-effort cache cleanup
          }
        }
        // Remove all grants for this document
        await permissions.grantStore.deleteByResource(
          docId,
          'document',
        );
      }
    }

    // Revoke all remaining grants for this user
    for (const grant of grants) {
      const wasRevoked = await permissions.grantStore.revoke(grant.id);
      if (wasRevoked) {
        deleted.push({ type: 'grant', id: grant.id });
      }
    }
  } else {
    // Transfer ownership of documents to transferTo user
    for (const docId of ownedDocIds) {
      // Revoke the old owner's grant
      const ownerGrant = grants.find(
        (g) =>
          g.resourceId === docId &&
          g.role === 'owner' &&
          g.resourceType === 'document',
      );
      if (ownerGrant) {
        await permissions.grantStore.revoke(ownerGrant.id);
        // Create new owner grant for transferTo
        await permissions.grantStore.create({
          principalId: transferTo!,
          resourceId: docId,
          resourceType: 'document',
          role: 'owner',
          grantedBy: userId,
        });
        transferred.push({ type: 'document', id: docId });
      }
    }

    // Revoke all non-owner grants for this user
    for (const grant of grants) {
      if (grant.role !== 'owner' || !ownedDocIds.includes(grant.resourceId)) {
        const wasRevoked = await permissions.grantStore.revoke(grant.id);
        if (wasRevoked) {
          deleted.push({ type: 'grant', id: grant.id });
        }
      }
    }
  }

  return {
    userId,
    action,
    transferTo: action === 'transfer' ? transferTo : undefined,
    deletedAt: new Date().toISOString(),
    deleted,
    transferred,
  };
}
