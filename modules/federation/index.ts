/** Contract: contracts/federation/rules.md */

// --- Contract types and schemas ---
export {
  PeerStatusSchema,
  PeerSchema,
  PeerRegistrationSchema,
  FederatedIdentitySchema,
  FederatedMessageSchema,
  FederatedRoleSchema,
  FederatedPermissionSchema,
  SyncChannelStatusSchema,
  SyncChannelSchema,
  KBSyncStatusSchema,
  KBFederationEntrySchema,
  KBSubscriptionSchema,
  SplitBrainTypeSchema,
  SplitBrainEventSchema,
  SAMLAssertionResultSchema,
  type Peer,
  type PeerStatus,
  type PeerRegistration,
  type FederatedIdentity,
  type FederatedMessage,
  type FederatedRole,
  type FederatedPermission,
  type SyncChannel,
  type SyncChannelStatus,
  type KBFederationEntry,
  type KBSubscription,
  type KBSyncStatus,
  type SplitBrainEvent,
  type SplitBrainType,
  type SAMLAssertionResult,
} from './contract.ts';

// --- Module factory ---
export { createFederation, type FederationModule, type FederationDependencies } from './internal/create-federation.ts';

// --- Signing ---
export { signMessage, verifySignature, generateKeyPair, exportPublicKey, importPublicKey } from './internal/signing.ts';

// --- Peer registry ---
export { registerPeer, verifyPeerMessage, PeerAlreadyExistsError, createInMemoryPeerStore, type PeerStore } from './internal/peer-registry.ts';

// --- Identity federation ---
export {
  verifyFederatedOidcToken,
  parseSAMLAssertion,
  mapIdentity,
  DuplicateIdentityError,
  createInMemoryIdentityStore,
  type IdentityStore,
} from './internal/identity-federation.ts';

// --- Sync protocol ---
export { createInMemorySyncMetadataStore, type SyncMetadataStore } from './internal/sync-metadata.ts';
export { openSyncChannel } from './internal/sync-outbound.ts';
export { handleIncomingSyncConnection } from './internal/sync-inbound.ts';

// --- Federated permissions ---
export {
  grantFederatedPermission,
  revokeFederatedPermission,
  checkFederatedPermission,
  RoleCeilingExceededError,
  PermissionAlreadyExistsError,
  createInMemoryPermissionStore,
  type FederatedPermissionStore,
} from './internal/federated-permissions.ts';

// --- KB federation ---
export {
  subscribeToCollection,
  syncKBEntry,
  detectKBDivergence,
  createInMemoryKBFederationStore,
  type KBFederationStore,
} from './internal/kb-federation.ts';

// --- Split-brain resolution ---
export {
  detectContentSplitBrain,
  detectMetadataSplitBrain,
  detectKBSplitBrain,
  resolveSplitBrain,
  createInMemorySplitBrainStore,
  type SplitBrainStore,
} from './internal/split-brain.ts';
