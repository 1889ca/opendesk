/** Contract: contracts/federation/rules.md */
import { z } from 'zod';

// --- Config ---

export const FederationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  instanceId: z.string().default(''),
  privateKey: z.string().default(''),
  publicKey: z.string().default(''),
});

export type FederationConfig = z.infer<typeof FederationConfigSchema>;

// --- Peer ---

export const FederationPeerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  endpointUrl: z.string().url(),
  publicKey: z.string().min(1),
  trustLevel: z.enum(['standard', 'elevated', 'restricted']),
  status: z.enum(['active', 'suspended', 'revoked']),
  lastSeenAt: z.string().nullable(),
  registeredBy: z.string(),
  createdAt: z.string(),
});

export type FederationPeer = z.infer<typeof FederationPeerSchema>;

// --- Transfer Record ---

export const TransferRecordSchema = z.object({
  id: z.string().uuid(),
  peerId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  documentId: z.string(),
  documentTitle: z.string().nullable(),
  signature: z.string(),
  auditProofHash: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'failed', 'rejected']),
  error: z.string().nullable(),
  createdAt: z.string(),
});

export type TransferRecord = z.infer<typeof TransferRecordSchema>;

// --- Transfer Bundle (sent/received between instances) ---

export const TransferBundleSchema = z.object({
  sendingInstanceId: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  yjsStateBase64: z.string(),
  auditProofHash: z.string().optional(),
  signature: z.string(),
  timestamp: z.string(),
});

export type TransferBundle = z.infer<typeof TransferBundleSchema>;

// --- Peer (internal representation used by branch code) ---

export const PeerSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string().url(),
  publicKey: z.string().min(1),
  status: z.enum(['active', 'suspended', 'revoked']),
  registeredAt: z.string(),
  lastSeenAt: z.string().nullable().optional(),
});

export type Peer = z.infer<typeof PeerSchema>;

export type PeerRegistration = Omit<Peer, 'status' | 'registeredAt' | 'lastSeenAt'>;
export type PeerStatus = 'active' | 'suspended' | 'revoked';

// --- Federated Message ---

export interface FederatedMessage {
  fromInstanceId: string;
  toInstanceId: string;
  type: string;
  payload: unknown;
  timestamp: string;
  signature: string;
}

// --- Federated Permission ---

export const FederatedPermissionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  peerInstanceId: z.string(),
  role: z.enum(['viewer', 'commenter', 'editor']),
  grantedBy: z.string(),
  grantedAt: z.string(),
  revokedAt: z.string().optional(),
});

export type FederatedPermission = z.infer<typeof FederatedPermissionSchema>;
export type FederatedRole = 'viewer' | 'commenter' | 'editor';

// --- Federated Identity ---

export const FederatedIdentitySchema = z.object({
  id: z.string().uuid(),
  localUserId: z.string(),
  remoteInstanceId: z.string(),
  remoteUserId: z.string(),
  provider: z.enum(['oidc', 'saml']),
  verifiedAt: z.string(),
});

export type FederatedIdentity = z.infer<typeof FederatedIdentitySchema>;

export type SAMLAssertionResult =
  | { ok: true; subject: string; issuer: string; attributes: Record<string, string> }
  | { ok: false; error: string };

// --- KB Federation ---

export const KBFederationEntrySchema = z.object({
  id: z.string().uuid(),
  entryId: z.string(),
  collectionId: z.string(),
  sourceInstanceId: z.string(),
  status: z.enum(['synced', 'pending', 'rejected', 'diverged']),
  jurisdiction: z.string().optional(),
  syncedAt: z.string(),
  version: z.number().int(),
});

export type KBFederationEntry = z.infer<typeof KBFederationEntrySchema>;
export type KBSyncStatus = 'synced' | 'pending' | 'rejected' | 'diverged';

export const KBSubscriptionSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string(),
  subscriberInstanceId: z.string(),
  publisherInstanceId: z.string(),
  subscribedAt: z.string(),
  active: z.boolean(),
});

export type KBSubscription = z.infer<typeof KBSubscriptionSchema>;

// --- Split Brain ---

export const SplitBrainEventSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  type: z.enum(['content', 'metadata', 'kb_entry']),
  localInstanceId: z.string(),
  remoteInstanceId: z.string(),
  detectedAt: z.string(),
  resolvedAt: z.string().optional(),
  resolution: z.enum(['pending', 'auto_merged', 'manual']),
});

export type SplitBrainEvent = z.infer<typeof SplitBrainEventSchema>;
export type SplitBrainType = 'content' | 'metadata' | 'kb_entry';

// --- Sync Channel ---

export interface SyncChannel {
  documentId: string;
  peerInstanceId: string;
  status: SyncChannelStatus;
  openedAt: string;
  lastSyncAt?: string;
}

export type SyncChannelStatus = 'active' | 'paused' | 'closed';

// --- Module Interface ---

export interface FederationModule {
  /** Register a new federation peer. */
  registerPeer(peer: Omit<FederationPeer, 'id' | 'createdAt' | 'lastSeenAt' | 'status'>): Promise<FederationPeer>;
  /** List all registered peers. */
  listPeers(): Promise<FederationPeer[]>;
  /** Update peer status (suspend, revoke, reactivate). */
  updatePeerStatus(peerId: string, status: 'active' | 'suspended' | 'revoked'): Promise<boolean>;
  /** Send a document to a peer. */
  sendDocument(documentId: string, peerId: string, actorId: string): Promise<TransferRecord>;
  /** Receive and verify an inbound transfer bundle. */
  receiveDocument(bundle: TransferBundle): Promise<TransferRecord>;
  /** List transfer history for a peer. */
  listTransfers(peerId?: string, limit?: number): Promise<TransferRecord[]>;
}
