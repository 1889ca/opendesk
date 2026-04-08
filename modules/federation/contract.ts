/** Contract: contracts/federation/rules.md */
import { z } from 'zod';

// --- Peer Instance ---

export const PeerStatusSchema = z.enum(['active', 'suspended', 'unreachable']);

export type PeerStatus = z.infer<typeof PeerStatusSchema>;

export const PeerSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string().url(),
  publicKey: z.string().min(1), // Ed25519 public key, base64-encoded
  status: PeerStatusSchema,
  registeredAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().optional(),
});

export type Peer = z.infer<typeof PeerSchema>;

export const PeerRegistrationSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string().url(),
  publicKey: z.string().min(1),
});

export type PeerRegistration = z.infer<typeof PeerRegistrationSchema>;

// --- Federated Identity ---

export const FederatedIdentitySchema = z.object({
  id: z.string().uuid(),
  localUserId: z.string().min(1),
  remoteInstanceId: z.string().min(1),
  remoteUserId: z.string().min(1),
  provider: z.enum(['oidc', 'saml']),
  verifiedAt: z.string().datetime(),
});

export type FederatedIdentity = z.infer<typeof FederatedIdentitySchema>;

// --- Federated Message Envelope ---

export const FederatedMessageSchema = z.object({
  fromInstanceId: z.string().min(1),
  toInstanceId: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
  timestamp: z.string().datetime(),
  signature: z.string().min(1), // Ed25519 signature, base64-encoded
});

export type FederatedMessage = z.infer<typeof FederatedMessageSchema>;

// --- Federated Permission ---

export const FederatedRoleSchema = z.enum(['viewer', 'editor', 'commenter']);

export type FederatedRole = z.infer<typeof FederatedRoleSchema>;

export const FederatedPermissionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().min(1),
  peerInstanceId: z.string().min(1),
  role: FederatedRoleSchema,
  grantedBy: z.string().min(1),
  grantedAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
});

export type FederatedPermission = z.infer<typeof FederatedPermissionSchema>;

// --- Sync Channel ---

export const SyncChannelStatusSchema = z.enum(['connecting', 'active', 'paused', 'closed']);

export type SyncChannelStatus = z.infer<typeof SyncChannelStatusSchema>;

export const SyncChannelSchema = z.object({
  documentId: z.string().min(1),
  peerInstanceId: z.string().min(1),
  status: SyncChannelStatusSchema,
  openedAt: z.string().datetime(),
  lastSyncAt: z.string().datetime().optional(),
});

export type SyncChannel = z.infer<typeof SyncChannelSchema>;

// --- KB Federation ---

export const KBSyncStatusSchema = z.enum(['synced', 'pending', 'diverged', 'rejected']);

export type KBSyncStatus = z.infer<typeof KBSyncStatusSchema>;

export const KBFederationEntrySchema = z.object({
  id: z.string().uuid(),
  entryId: z.string().min(1),
  collectionId: z.string().min(1),
  sourceInstanceId: z.string().min(1),
  status: KBSyncStatusSchema,
  jurisdiction: z.string().optional(),
  syncedAt: z.string().datetime().optional(),
  version: z.number().int().nonnegative(),
});

export type KBFederationEntry = z.infer<typeof KBFederationEntrySchema>;

export const KBSubscriptionSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().min(1),
  subscriberInstanceId: z.string().min(1),
  publisherInstanceId: z.string().min(1),
  subscribedAt: z.string().datetime(),
  active: z.boolean(),
});

export type KBSubscription = z.infer<typeof KBSubscriptionSchema>;

// --- Split-Brain ---

export const SplitBrainTypeSchema = z.enum(['content', 'metadata', 'kb_entry']);

export type SplitBrainType = z.infer<typeof SplitBrainTypeSchema>;

export const SplitBrainEventSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().min(1),
  type: SplitBrainTypeSchema,
  localInstanceId: z.string().min(1),
  remoteInstanceId: z.string().min(1),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolution: z.enum(['auto_merged', 'manual', 'pending']).optional(),
});

export type SplitBrainEvent = z.infer<typeof SplitBrainEventSchema>;

// --- SAML Assertion ---

export const SAMLAssertionResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    subject: z.string().min(1),
    issuer: z.string().min(1),
    attributes: z.record(z.string()),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string().min(1),
  }),
]);

export type SAMLAssertionResult = z.infer<typeof SAMLAssertionResultSchema>;
