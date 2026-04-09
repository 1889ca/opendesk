/** Contract: contracts/core/manifest/rules.md */

export { manifests } from './registry.ts';

export {
  filterEnabled,
  mountManifestRoutes,
  runManifestStartHooks,
  runManifestShutdownHooks,
  collectManifestBundles,
  createServiceRegistry,
  type ManifestStartHandle,
} from './mount.ts';

export type {
  AppContext,
  ApiRouteSpec,
  FrontendBundleKind,
  FrontendBundleSpec,
  FrontendSpec,
  LifecycleSpec,
  OpenDeskManifest,
} from './contract.ts';
