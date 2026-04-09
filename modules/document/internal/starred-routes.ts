/** Contract: contracts/document/rules.md */
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export type StarredRoutesOptions = {
  permissions: PermissionsModule;
  pool: Pool;
};

/** CRUD routes for starred documents. */
export function createStarredRoutes(opts: StarredRoutesOptions): Router {
  const router = Router();
  const { permissions, pool } = opts;

  // List starred documents for the authenticated user
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const { rows } = await pool.query(
        `SELECT d.id, d.title, d.updated_at, d.document_type, sd.starred_at
         FROM starred_documents sd
         JOIN documents d ON d.id = sd.document_id
         WHERE sd.user_id = $1
         ORDER BY sd.starred_at DESC`,
        [userId],
      );
      res.json(rows);
    }),
  );

  // Star a document
  router.post(
    '/:documentId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const documentId = String(req.params.documentId);
      await pool.query(
        `INSERT INTO starred_documents (user_id, document_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, document_id) DO NOTHING`,
        [userId, documentId],
      );
      res.status(201).json({ ok: true });
    }),
  );

  // Unstar a document
  router.delete(
    '/:documentId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.principal!.id;
      const documentId = String(req.params.documentId);
      const { rowCount } = await pool.query(
        `DELETE FROM starred_documents
         WHERE user_id = $1 AND document_id = $2`,
        [userId, documentId],
      );
      if ((rowCount ?? 0) === 0) {
        res.status(404).json({ error: 'Not starred' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
