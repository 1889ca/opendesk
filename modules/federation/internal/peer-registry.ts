/** Contract: contracts/federation/rules.md */
import {
  PeerSchema,
  type Peer,
  type PeerRegistration,
  type PeerStatus,
  type FederatedMessage,
} from '../contract.ts';
import { importPublicKey, verifyMessage } from './signing.ts';

/** Storage interface for peer persistence. */
export interface PeerStore {
  save(peer: Peer): Promise<void>;
  findById(instanceId: string): Promise<Peer | null>;
  findAll(): Promise<Peer[]>;
  updateStatus(instanceId: string, status: PeerStatus, lastSeenAt?: string): Promise<void>;
  remove(instanceId: string): Promise<void>;
}

/** In-memory peer store for development/testing. */
export function createInMemoryPeerStore(): PeerStore {
  const peers = new Map<string, Peer>();

  return {
    async save(peer) {
      PeerSchema.parse(peer);
      peers.set(peer.instanceId, peer);
    },
    async findById(instanceId) {
      return peers.get(instanceId) ?? null;
    },
    async findAll() {
      return [...peers.values()];
    },
    async updateStatus(instanceId, status, lastSeenAt) {
      const peer = peers.get(instanceId);
      if (!peer) return;
      peers.set(instanceId, { ...peer, status, lastSeenAt: lastSeenAt ?? peer.lastSeenAt });
    },
    async remove(instanceId) {
      peers.delete(instanceId);
    },
  };
}

/** Register a new peer instance. Validates the public key format. */
export async function registerPeer(
  store: PeerStore,
  registration: PeerRegistration,
): Promise<Peer> {
  // Validate public key is importable
  importPublicKey(registration.publicKey);

  const existing = await store.findById(registration.instanceId);
  if (existing) {
    throw new PeerAlreadyExistsError(registration.instanceId);
  }

  const peer: Peer = {
    ...registration,
    status: 'active',
    registeredAt: new Date().toISOString(),
  };

  await store.save(peer);
  return peer;
}

/** Verify an incoming federated message against the sender's stored public key. */
export async function verifyPeerMessage(
  store: PeerStore,
  message: FederatedMessage,
): Promise<boolean> {
  const peer = await store.findById(message.fromInstanceId);
  if (!peer || peer.status !== 'active') return false;

  const publicKey = importPublicKey(peer.publicKey);
  return verifyMessage(message as unknown as Record<string, unknown> & { signature: string }, publicKey);
}

export class PeerAlreadyExistsError extends Error {
  constructor(instanceId: string) {
    super(`Peer already registered: ${instanceId}`);
    this.name = 'PeerAlreadyExistsError';
  }
}
