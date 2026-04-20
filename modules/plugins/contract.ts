/** Contract: contracts/plugins/rules.md */
import { z } from 'zod';

export const CapabilitySchema = z.enum([
  'document.read',
  'document.write',
  'sheet.read',
  'sheet.write',
  'slide.read',
  'slide.write',
  'kb.read',
  'kb.write',
  'workflow.invoke',
  'net.fetch',
]);

export type Capability = z.infer<typeof CapabilitySchema>;

export const HookSchema = z.enum([
  'on_save',
  'on_export',
  'on_share',
  'on_kb_update',
  'on_form_response',
]);

export type Hook = z.infer<typeof HookSchema>;

export const UiContributionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('toolbar_button'),
    id: z.string().min(1),
    target: z.enum(['document', 'sheet', 'slide', 'diagram']),
    label: z.string().min(1),
    icon: z.string().optional(),
  }),
  z.object({
    kind: z.literal('sidebar_panel'),
    id: z.string().min(1),
    target: z.enum(['document', 'sheet', 'slide', 'diagram', 'global']),
    title: z.string().min(1),
  }),
]);

export type UiContribution = z.infer<typeof UiContributionSchema>;

export const PluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  host_api: z.string().min(1),
  entry_wasm: z.string().optional(),
  entry_ui: z.string().optional(),
  hooks: z.array(HookSchema).default([]),
  capabilities: z.array(CapabilitySchema).default([]),
  ui: z.array(UiContributionSchema).default([]),
  publisher: z.string().min(1),
  signature: z.string().min(1).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export const InstalledPluginSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  manifest: PluginManifestSchema,
  enabled: z.boolean(),
  installed_by: z.string().min(1),
  installed_at: z.string(),
});

export type InstalledPlugin = z.infer<typeof InstalledPluginSchema>;

export interface PluginRegistry {
  install(workspaceId: string, manifest: PluginManifest, installedBy: string): Promise<InstalledPlugin>;
  uninstall(workspaceId: string, pluginId: string): Promise<void>;
  setEnabled(workspaceId: string, pluginId: string, enabled: boolean): Promise<void>;
  listInstalled(workspaceId: string): Promise<InstalledPlugin[]>;
  forHook(workspaceId: string, hook: Hook): Promise<InstalledPlugin[]>;
}

export interface PluginsModule {
  registry: PluginRegistry;
}
