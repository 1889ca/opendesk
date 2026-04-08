/** Contract: contracts/federation/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  subscribeToCollection,
  syncKBEntry,
  detectKBDivergence,
  createInMemoryKBFederationStore,
  type KBFederationStore,
} from './kb-federation.ts';

describe('kb-federation', () => {
  let store: KBFederationStore;

  beforeEach(() => {
    store = createInMemoryKBFederationStore();
  });

  describe('subscribeToCollection', () => {
    it('creates a new subscription', async () => {
      const sub = await subscribeToCollection(store, 'col-1', 'sub-inst', 'pub-inst');
      expect(sub.collectionId).toBe('col-1');
      expect(sub.subscriberInstanceId).toBe('sub-inst');
      expect(sub.active).toBe(true);
    });

    it('returns existing subscription for duplicate', async () => {
      const first = await subscribeToCollection(store, 'col-1', 'sub-inst', 'pub-inst');
      const second = await subscribeToCollection(store, 'col-1', 'sub-inst', 'pub-inst');
      expect(first.id).toBe(second.id);
    });
  });

  describe('syncKBEntry', () => {
    it('syncs a published entry', async () => {
      const entry = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, undefined, 'published');
      expect(entry).not.toBeNull();
      expect(entry!.status).toBe('synced');
      expect(entry!.version).toBe(1);
    });

    it('skips draft entries', async () => {
      const entry = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, undefined, 'draft');
      expect(entry).toBeNull();
    });

    it('skips deprecated entries', async () => {
      const entry = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, undefined, 'deprecated');
      expect(entry).toBeNull();
    });

    it('updates to newer version (last-writer-wins)', async () => {
      await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, undefined, 'published');
      const updated = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 2, undefined, 'published');
      expect(updated!.version).toBe(2);
    });

    it('ignores older version', async () => {
      await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 3, undefined, 'published');
      const old = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 2, undefined, 'published');
      expect(old!.version).toBe(3);
    });

    it('rejects cross-jurisdiction merge', async () => {
      await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, 'US', 'published');
      const result = await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 2, 'EU', 'published');
      expect(result!.status).toBe('rejected');
    });
  });

  describe('detectKBDivergence', () => {
    it('detects divergence when versions differ', async () => {
      await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 1, undefined, 'published');
      const status = await detectKBDivergence(store, 'entry-1', 'source-inst', 3, 1, undefined, undefined);
      expect(status).toBe('diverged');
    });

    it('reports synced when versions match', async () => {
      await syncKBEntry(store, 'entry-1', 'col-1', 'source-inst', 2, undefined, 'published');
      const status = await detectKBDivergence(store, 'entry-1', 'source-inst', 2, 2, undefined, undefined);
      expect(status).toBe('synced');
    });

    it('rejects cross-jurisdiction comparison', async () => {
      const status = await detectKBDivergence(store, 'entry-1', 'source-inst', 1, 1, 'US', 'EU');
      expect(status).toBe('rejected');
    });
  });
});
