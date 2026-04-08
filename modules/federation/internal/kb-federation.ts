/** Contract: contracts/federation/rules.md */
import { randomUUID } from 'node:crypto';
import type { KBFederationEntry, KBSubscription, KBSyncStatus } from '../contract.ts';
import { KBFederationEntrySchema, KBSubscriptionSchema } from '../contract.ts';

/** Storage interface for KB federation entries. */
export interface KBFederationStore {
  saveEntry(entry: KBFederationEntry): Promise<void>;
  findEntry(entryId: string, sourceInstanceId: string): Promise<KBFederationEntry | null>;
  findByCollection(collectionId: string): Promise<KBFederationEntry[]>;
  updateStatus(id: string, status: KBSyncStatus): Promise<void>;
  saveSubscription(sub: KBSubscription): Promise<void>;
  findSubscription(collectionId: string, subscriberInstanceId: string): Promise<KBSubscription | null>;
  findSubscriptionsByCollection(collectionId: string): Promise<KBSubscription[]>;
  deactivateSubscription(id: string): Promise<void>;
}

export function createInMemoryKBFederationStore(): KBFederationStore {
  const entries = new Map<string, KBFederationEntry>();
  const subscriptions = new Map<string, KBSubscription>();

  return {
    async saveEntry(entry) {
      KBFederationEntrySchema.parse(entry);
      entries.set(entry.id, entry);
    },
    async findEntry(entryId, sourceInstanceId) {
      return [...entries.values()].find(
        (e) => e.entryId === entryId && e.sourceInstanceId === sourceInstanceId,
      ) ?? null;
    },
    async findByCollection(collectionId) {
      return [...entries.values()].filter((e) => e.collectionId === collectionId);
    },
    async updateStatus(id, status) {
      const entry = entries.get(id);
      if (entry) entries.set(id, { ...entry, status });
    },
    async saveSubscription(sub) {
      KBSubscriptionSchema.parse(sub);
      subscriptions.set(sub.id, sub);
    },
    async findSubscription(collectionId, subscriberInstanceId) {
      return [...subscriptions.values()].find(
        (s) => s.collectionId === collectionId && s.subscriberInstanceId === subscriberInstanceId && s.active,
      ) ?? null;
    },
    async findSubscriptionsByCollection(collectionId) {
      return [...subscriptions.values()].filter((s) => s.collectionId === collectionId && s.active);
    },
    async deactivateSubscription(id) {
      const sub = subscriptions.get(id);
      if (sub) subscriptions.set(id, { ...sub, active: false });
    },
  };
}

/** Subscribe a peer instance to a KB collection. */
export async function subscribeToCollection(
  store: KBFederationStore,
  collectionId: string,
  subscriberInstanceId: string,
  publisherInstanceId: string,
): Promise<KBSubscription> {
  const existing = await store.findSubscription(collectionId, subscriberInstanceId);
  if (existing) return existing;

  const sub: KBSubscription = {
    id: randomUUID(),
    collectionId,
    subscriberInstanceId,
    publisherInstanceId,
    subscribedAt: new Date().toISOString(),
    active: true,
  };

  await store.saveSubscription(sub);
  return sub;
}

/** Sync a KB entry from a remote instance. Enforces jurisdiction isolation. */
export async function syncKBEntry(
  store: KBFederationStore,
  entryId: string,
  collectionId: string,
  sourceInstanceId: string,
  version: number,
  jurisdiction: string | undefined,
  entryStatus: 'published' | 'draft' | 'deprecated',
): Promise<KBFederationEntry | null> {
  // Only sync published entries
  if (entryStatus !== 'published') return null;

  const existing = await store.findEntry(entryId, sourceInstanceId);

  if (existing) {
    // Jurisdiction isolation: never auto-merge across jurisdictions
    if (existing.jurisdiction && jurisdiction && existing.jurisdiction !== jurisdiction) {
      await store.updateStatus(existing.id, 'rejected');
      return { ...existing, status: 'rejected' };
    }

    // Last-writer-wins with version comparison
    if (version <= existing.version) return existing;

    const updated: KBFederationEntry = {
      ...existing,
      version,
      status: 'synced',
      syncedAt: new Date().toISOString(),
    };
    await store.saveEntry(updated);
    return updated;
  }

  const entry: KBFederationEntry = {
    id: randomUUID(),
    entryId,
    collectionId,
    sourceInstanceId,
    status: 'synced',
    jurisdiction,
    syncedAt: new Date().toISOString(),
    version,
  };

  await store.saveEntry(entry);
  return entry;
}

/**
 * Detect divergence for a KB entry. Called on reconnect when both instances
 * have modified the same entry during a partition.
 */
export async function detectKBDivergence(
  store: KBFederationStore,
  entryId: string,
  sourceInstanceId: string,
  remoteVersion: number,
  localVersion: number,
  remoteJurisdiction: string | undefined,
  localJurisdiction: string | undefined,
): Promise<KBSyncStatus> {
  // Cross-jurisdiction entries always diverge
  if (localJurisdiction && remoteJurisdiction && localJurisdiction !== remoteJurisdiction) {
    return 'rejected';
  }

  const existing = await store.findEntry(entryId, sourceInstanceId);

  if (!existing) return 'pending';

  // Both modified during partition: flag as diverged
  if (remoteVersion !== localVersion) {
    await store.updateStatus(existing.id, 'diverged');
    return 'diverged';
  }

  return 'synced';
}
