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
