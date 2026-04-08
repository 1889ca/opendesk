/** Contract: contracts/federation/rules.md */
import type { SyncChannel, SyncChannelStatus } from '../contract.ts';

/** Metadata tracker for shared documents across instances. */
export interface SyncMetadataStore {
  save(channel: SyncChannel): Promise<void>;
  find(documentId: string, peerInstanceId: string): Promise<SyncChannel | null>;
  findByDocument(documentId: string): Promise<SyncChannel[]>;
  updateStatus(documentId: string, peerInstanceId: string, status: SyncChannelStatus): Promise<void>;
  updateLastSync(documentId: string, peerInstanceId: string): Promise<void>;
}

export function createInMemorySyncMetadataStore(): SyncMetadataStore {
  const channels = new Map<string, SyncChannel>();

  function key(docId: string, peerId: string): string {
    return `${docId}:${peerId}`;
  }

  return {
    async save(channel) {
      channels.set(key(channel.documentId, channel.peerInstanceId), channel);
    },
    async find(documentId, peerInstanceId) {
      return channels.get(key(documentId, peerInstanceId)) ?? null;
    },
    async findByDocument(documentId) {
      return [...channels.values()].filter((c) => c.documentId === documentId);
    },
    async updateStatus(documentId, peerInstanceId, status) {
      const ch = channels.get(key(documentId, peerInstanceId));
      if (ch) channels.set(key(documentId, peerInstanceId), { ...ch, status });
    },
    async updateLastSync(documentId, peerInstanceId) {
      const ch = channels.get(key(documentId, peerInstanceId));
      if (ch) channels.set(key(documentId, peerInstanceId), { ...ch, lastSyncAt: new Date().toISOString() });
    },
  };
}
