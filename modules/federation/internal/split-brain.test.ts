/** Contract: contracts/federation/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  detectContentSplitBrain,
  detectMetadataSplitBrain,
  detectKBSplitBrain,
  resolveSplitBrain,
  createInMemorySplitBrainStore,
  type SplitBrainStore,
} from './split-brain.ts';

describe('split-brain', () => {
  let store: SplitBrainStore;

  beforeEach(() => {
    store = createInMemorySplitBrainStore();
  });

  describe('detectContentSplitBrain', () => {
    it('auto-merges diverged Yjs content', async () => {
      // Create two diverged docs
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.getMap('data').set('field1', 'value-from-instance-a');
      doc2.getMap('data').set('field2', 'value-from-instance-b');

      const state1 = Y.encodeStateAsUpdate(doc1);
      const state2 = Y.encodeStateAsUpdate(doc2);

      const result = await detectContentSplitBrain(
        store, 'doc-1', state1, state2, 'inst-a', 'inst-b',
      );

      expect(result.event.type).toBe('content');
      expect(result.event.resolution).toBe('auto_merged');
      expect(result.merged).toBeInstanceOf(Uint8Array);

      // Verify merged state contains both fields
      const mergedDoc = new Y.Doc();
      Y.applyUpdate(mergedDoc, result.merged);
      expect(mergedDoc.getMap('data').get('field1')).toBe('value-from-instance-a');
      expect(mergedDoc.getMap('data').get('field2')).toBe('value-from-instance-b');

      doc1.destroy();
      doc2.destroy();
      mergedDoc.destroy();
    });

    it('logs the event in the store', async () => {
      const doc = new Y.Doc();
      const state = Y.encodeStateAsUpdate(doc);

      await detectContentSplitBrain(store, 'doc-1', state, state, 'inst-a', 'inst-b');
      const events = await store.findByDocument('doc-1');
      expect(events).toHaveLength(1);
      expect(events[0].resolution).toBe('auto_merged');

      doc.destroy();
    });
  });

  describe('detectMetadataSplitBrain', () => {
    it('detects conflicting metadata', async () => {
      const event = await detectMetadataSplitBrain(
        store, 'doc-1', 'inst-a', 'inst-b',
        { title: 'Version A', tags: ['a'] },
        { title: 'Version B', tags: ['b'] },
      );

      expect(event).not.toBeNull();
      expect(event!.type).toBe('metadata');
      expect(event!.resolution).toBe('pending');
    });

    it('returns null when metadata matches', async () => {
      const event = await detectMetadataSplitBrain(
        store, 'doc-1', 'inst-a', 'inst-b',
        { title: 'Same Title' },
        { title: 'Same Title' },
      );
      expect(event).toBeNull();
    });
  });

  describe('detectKBSplitBrain', () => {
    it('creates a pending KB split-brain event', async () => {
      const event = await detectKBSplitBrain(store, 'entry-1', 'inst-a', 'inst-b');
      expect(event.type).toBe('kb_entry');
      expect(event.resolution).toBe('pending');
    });
  });

  describe('resolveSplitBrain', () => {
    it('resolves a pending event', async () => {
      const event = await detectKBSplitBrain(store, 'entry-1', 'inst-a', 'inst-b');
      await resolveSplitBrain(store, event.id);

      const pending = await store.findPending('entry-1');
      expect(pending).toHaveLength(0);

      const all = await store.findByDocument('entry-1');
      expect(all[0].resolution).toBe('manual');
      expect(all[0].resolvedAt).toBeTruthy();
    });
  });
});
