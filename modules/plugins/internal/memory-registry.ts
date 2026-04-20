/** Contract: contracts/plugins/rules.md */

/**
 * Skeleton PluginRegistry. Production will:
 *   - Verify Ed25519 signatures against the workspace trust store
 *   - Persist to Postgres (`installed_plugins` table)
 *   - Intersect declared capabilities with workspace policy before install
 *   - Dispatch hooks via the `workflow` Wasm sandbox with per-plugin
 *     memory/CPU/time budgets
 *   - Emit `PluginInstalled` / `PluginExecuted` / `PluginFailed` events
 *     (sampled for executions above N/minute)
 */

import { randomUUID } from 'node:crypto';
import {
  PluginManifestSchema,
  type Hook,
  type InstalledPlugin,
  type PluginManifest,
  type PluginRegistry,
} from '../contract.ts';

export function createMemoryPluginRegistry(): PluginRegistry {
  const byWorkspace = new Map<string, InstalledPlugin[]>();

  function list(workspaceId: string): InstalledPlugin[] {
    return byWorkspace.get(workspaceId) ?? [];
  }

  return {
    async install(workspaceId, manifest: PluginManifest, installedBy) {
      const parsed = PluginManifestSchema.parse(manifest);
      const existing = list(workspaceId);
      const installed: InstalledPlugin = {
        id: randomUUID(),
        workspace_id: workspaceId,
        manifest: parsed,
        enabled: true,
        installed_by: installedBy,
        installed_at: new Date().toISOString(),
      };
      byWorkspace.set(workspaceId, [...existing, installed]);
      return installed;
    },

    async uninstall(workspaceId, pluginId) {
      byWorkspace.set(
        workspaceId,
        list(workspaceId).filter((p) => p.id !== pluginId),
      );
    },

    async setEnabled(workspaceId, pluginId, enabled) {
      byWorkspace.set(
        workspaceId,
        list(workspaceId).map((p) =>
          p.id === pluginId ? { ...p, enabled } : p,
        ),
      );
    },

    async listInstalled(workspaceId) {
      return list(workspaceId);
    },

    async forHook(workspaceId: string, hook: Hook) {
      return list(workspaceId).filter(
        (p) => p.enabled && p.manifest.hooks.includes(hook),
      );
    },
  };
}
