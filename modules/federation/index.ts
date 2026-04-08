/** Contract: contracts/federation/rules.md */

// Schemas & types
export {
  FederationConfigSchema,
  FederationPeerSchema,
  TransferRecordSchema,
  TransferBundleSchema,
  type FederationConfig,
  type FederationPeer,
  type TransferRecord,
  type TransferBundle,
  type FederationModule,
} from './contract.ts';

// Factory
export { createFederation, type FederationDependencies } from './internal/create-federation.ts';

// Routes
export { createFederationRoutes, type FederationRoutesOptions } from './internal/federation-routes.ts';

// Crypto utilities
export { signPayload, verifySignature, sha256 } from './internal/signing.ts';
