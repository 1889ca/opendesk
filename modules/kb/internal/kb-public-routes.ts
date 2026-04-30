/** Contract: contracts/kb/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { pool } from '../../storage/internal/pool.ts';
import { listEntries } from './entries-store.ts';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

export type KBPublicRoutesOptions = {
  permissions: PermissionsModule;
};

/** Check if the KB workspace is marked public. */
async function isKBPublic(workspaceId: string): Promise<boolean> {
  const result = await pool.query<{ is_public: boolean }>(
    'SELECT is_public FROM kb_settings WHERE workspace_id = $1',
    [workspaceId],
  );
  return result.rows[0]?.is_public ?? false;
}

/** Ensure a kb_settings row exists for the workspace. */
async function ensureKBSettings(workspaceId: string): Promise<void> {
  await pool.query(
    `INSERT INTO kb_settings (workspace_id, is_public)
     VALUES ($1, false)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId],
  );
}

/** Get the current KB settings. */
async function getKBSettings(workspaceId: string): Promise<{ is_public: boolean }> {
  await ensureKBSettings(workspaceId);
  const result = await pool.query<{ is_public: boolean }>(
    'SELECT is_public FROM kb_settings WHERE workspace_id = $1',
    [workspaceId],
  );
  return { is_public: result.rows[0]?.is_public ?? false };
}

/** Update KB public setting. */
async function setKBPublic(workspaceId: string, isPublic: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO kb_settings (workspace_id, is_public)
     VALUES ($1, $2)
     ON CONFLICT (workspace_id) DO UPDATE SET is_public = $2, updated_at = NOW()`,
    [workspaceId, isPublic],
  );
}

const SettingsBodySchema = z.object({
  is_public: z.boolean(),
});

/** Mount KB public access and settings routes. */
export function createKBPublicRoutes(opts: KBPublicRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // Public read-only access — no auth required
  router.get(
    '/public',
    asyncHandler(async (_req: Request, res: Response) => {
      const isPublic = await isKBPublic(WORKSPACE_ID);
      if (!isPublic) {
        res.status(403).json({ error: 'This knowledge base is not publicly accessible' });
        return;
      }
      const entries = await listEntries(WORKSPACE_ID);
      // Strip internal fields for public consumers
      const safe = entries.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        title: e.title,
        metadata: e.metadata,
        tags: e.tags,
        version: e.version,
        corpus: e.corpus,
        updatedAt: e.updatedAt,
      }));
      res.json({ entries: safe });
    }),
  );

  // Get KB settings (authenticated)
  router.get(
    '/settings',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await getKBSettings(WORKSPACE_ID);
      const origin = process.env.PUBLIC_URL ?? 'http://localhost:3000';
      res.json({
        ...settings,
        public_url: settings.is_public ? `${origin}/kb/public` : null,
      });
    }),
  );

  // Update KB settings (admin only)
  // Fix #484: toggling KB public access must require admin, not just any
  // authenticated user — any authenticated user could previously expose
  // the entire knowledge base publicly.
  router.post(
    '/settings',
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const bodyResult = SettingsBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      await setKBPublic(WORKSPACE_ID, bodyResult.data.is_public);
      const origin = process.env.PUBLIC_URL ?? 'http://localhost:3000';
      res.json({
        ok: true,
        is_public: bodyResult.data.is_public,
        public_url: bodyResult.data.is_public ? `${origin}/kb/public` : null,
      });
    }),
  );

  return router;
}
