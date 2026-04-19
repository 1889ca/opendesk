/** Contract: contracts/plugins/rules.md */
export {
  CapabilitySchema,
  HookSchema,
  UiContributionSchema,
  PluginManifestSchema,
  InstalledPluginSchema,
} from './contract.ts';

export type {
  Capability,
  Hook,
  UiContribution,
  PluginManifest,
  InstalledPlugin,
  PluginRegistry,
  PluginsModule,
} from './contract.ts';

export { createMemoryPluginRegistry } from './internal/memory-registry.ts';
