/** Contract: contracts/events/rules.md */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DomainEvent } from '../contract.ts';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as import('pg').Pool;
const mockClient = { query: mockQuery } as unknown as import('pg').PoolClient;

import { insertOutboxEntry, findUnpublished, markPublished, pruneOlderThan } from './outbox-store.ts';

describe('outbox-store', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  const event: DomainEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'DocumentUpdated',
    aggregateId: 'doc-123',
    actorId: 'user-1',
    actorType: 'human',
    occurredAt: '2026-04-07T12:00:00.000Z',
  };

  describe('insertOutboxEntry', () => {
    it('inserts event into outbox table', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await insertOutboxEntry(mockClient, event);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO event_outbox');
      expect(params[0]).toBe(event.id);
      expect(params[1]).toBe('DocumentUpdated');
      expect(params[2]).toBe('doc-123');
    });

    it('passes null for missing revisionId', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await insertOutboxEntry(mockClient, event);

      const params = mockQuery.mock.calls[0][1];
      expect(params[3]).toBeNull(); // revisionId
    });
  });

  describe('findUnpublished', () => {
    it('returns formatted entries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: event.id,
          type: 'DocumentUpdated',
          aggregateId: 'doc-123',
          revisionId: null,
          actorId: 'user-1',
          actorType: 'human',
          occurredAt: new Date('2026-04-07T12:00:00.000Z'),
          publishedAt: null,
        }],
      });

      const entries = await findUnpublished(mockPool, 10);
      expect(entries).toHaveLength(1);
      expect(entries[0].publishedAt).toBeNull();
      expect(typeof entries[0].occurredAt).toBe('string');
    });
  });

  describe('markPublished', () => {
    it('skips when no ids provided', async () => {
      await markPublished(mockPool, []);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('updates published_at for given ids', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 2 });
      await markPublished(mockPool, ['id-1', 'id-2']);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE event_outbox SET published_at');
      expect(params).toEqual(['id-1', 'id-2']);
    });
  });

  describe('pruneOlderThan', () => {
    it('deletes old entries and returns count', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 5 });
      const count = await pruneOlderThan(mockPool, 7);
      expect(count).toBe(5);

      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('7 days');
    });
  });
});
