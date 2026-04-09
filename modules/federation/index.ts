/** Contract: contracts/federation/rules.md */

// Schemas & types
export {
  FederationConfigSchema,
  FederationPeerSchema,
  TransferRecordSchema,
  TransferBundleSchema,
  PeerSchema,
  FederatedPermissionSchema,
  FederatedIdentitySchema,
  KBFederationEntrySchema,
  KBSubscriptionSchema,
  SplitBrainEventSchema,
  type FederationConfig,
  type FederationPeer,
  type TransferRecord,
  type TransferBundle,
  type FederationModule,
  type Peer,
  type PeerRegistration,
  type PeerStatus,
  type FederatedMessage,
  type FederatedPermission,
  type FederatedRole,
  type FederatedIdentity,
  type SAMLAssertionResult,
  type KBFederationEntry,
  type KBSubscription,
  type KBSyncStatus,
  type SplitBrainEvent,
  type SplitBrainType,
  type SyncChannel,
  type SyncChannelStatus,
} from './contract.ts';

// Factory
export { createFederation, type FederationDependencies } from './internal/create-federation.ts';

// Routes
export { createFederationRoutes, type FederationRoutesOptions } from './internal/federation-routes.ts';

// Crypto utilities
export { signPayload, verifySignature, sha256, generateKeyPair, exportPublicKey, importPublicKey, signMessage, verifyMessage } from './internal/signing.ts';
