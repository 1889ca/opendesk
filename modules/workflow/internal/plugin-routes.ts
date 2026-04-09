/** Contract: contracts/workflow/rules.md */
import { Router, type Request, type Response } from 'express';
import type { PermissionsModule } from '../../permissions/index.ts';
import { CreateWasmPluginSchema } from './plugin-types.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import type { Pool } from 'pg';
import * as pluginStore from './plugin-store.ts';

export type PluginRoutesOptions = {
  permissions: PermissionsModule;
  pool: Pool;
};

export function createPluginRoutes(opts: PluginRoutesOptions): Router {
  const router = Router();
  const { permissions, pool } = opts;

  // List all plugins
  router.get(
    '/',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const plugins = await pluginStore.listPlugins(pool);
      res.json(plugins);
    }),
  );

  // Get plugin schema
  router.get(
    '/:id/schema',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const plugin = await pluginStore.getPlugin(pool, String(req.params.id));
      if (!plugin) {
        res.status(404).json({ error: 'Plugin not found' });
        return;
      }
      res.json({
        inputSchema: plugin.inputSchema,
        outputSchema: plugin.outputSchema,
      });
    }),
  );

  // Upload a new plugin (binary in body, metadata in query/headers)
  router.post(
    '/',
    permissions.requireAuth,
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const metaResult = CreateWasmPluginSchema.safeParse(req.body?.metadata ?? req.body);
      if (!metaResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: metaResult.error.issues });
        return;
      }

      const wasmBinary = req.body?.wasmBinary;
      if (!wasmBinary) {
        res.status(400).json({ error: 'wasmBinary field required (base64-encoded)' });
        return;
      }

      let binary: Buffer;
      try {
        binary = Buffer.from(wasmBinary, 'base64');
      } catch {
        res.status(400).json({ error: 'wasmBinary must be valid base64' });
        return;
      }

      if (!WebAssembly.validate(binary as unknown as BufferSource)) {
        res.status(400).json({ error: 'Invalid Wasm binary' });
        return;
      }

      const plugin = await pluginStore.createPlugin(pool, metaResult.data, binary);
      res.status(201).json(plugin);
    }),
  );

  // Delete a plugin (cannot delete built-in plugins)
  router.delete(
    '/:id',
    permissions.requireAuth,
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const deleted = await pluginStore.deletePlugin(pool, String(req.params.id));
      if (!deleted) {
        res.status(404).json({ error: 'Plugin not found or is built-in' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
