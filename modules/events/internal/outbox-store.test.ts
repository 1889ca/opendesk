/** Contract: contracts/events/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '../contract.ts';
import {
  insertOutboxEntry,
  findUnpublished,
  markPublished,
  pruneOlderThan,
} from './outbox-store.ts';
import { describeIntegration } from '../../../tests/integration/test-pg.ts';

// Issue #127: this test used to mock pg.Pool with a vi.fn() query
// recorder. The integration version exercises the real event_outbox
// table from migration 003.

// The EventType enum at the contract layer is closed to production
// types; the event_outbox table doesn't constrain the type column at
// the schema level, so we cast a test-only string and clean it up by
// prefix between tests.
const T_OUTBOX_TEST = 'TestOutbox/DocumentUpdated' as DomainEvent['type'];

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: randomUUID(),
    type: T_OUTBOX_TEST,
    aggregateId: `doc-${randomUUID()}`,
    actorId: 'user-1',
    actorType: 'human',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

describeIntegration('outbox-store (integration)', (ctx) => {
  beforeEach(async () => {
    if (!ctx.pool) return;
    // Each test starts from an empty outbox for our test event type.
    // Other tests in the suite may have pushed real events; only
    // wipe rows we own.
    await ctx.pool.query(
      "DELETE FROM event_outbox WHERE type LIKE 'TestOutbox/%'",
    );
  });

  describe('insertOutboxEntry', () => {
    it('inserts an event into event_outbox via a transaction client', async () => {
      if (!ctx.pool) return;

      const event = makeEvent();
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, event);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const { rows } = await ctx.pool.query<{ id: string; type: string; aggregate_id: string }>(
        'SELECT id, type, aggregate_id FROM event_outbox WHERE id = $1',
        [event.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe(event.type);
      expect(rows[0].aggregate_id).toBe(event.aggregateId);
    });

    it('persists null when revisionId is missing', async () => {
      if (!ctx.pool) return;

      const event = makeEvent();
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, event);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const { rows } = await ctx.pool.query<{ revision_id: string | null }>(
        'SELECT revision_id FROM event_outbox WHERE id = $1',
        [event.id],
      );
      expect(rows[0].revision_id).toBeNull();
    });
  });

  describe('findUnpublished', () => {
    it('returns unpublished entries with ISO date strings', async () => {
      if (!ctx.pool) return;

      const event = makeEvent();
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, event);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const all = await findUnpublished(ctx.pool, 100);
      const ours = all.find((e) => e.id === event.id);
      expect(ours).toBeDefined();
      expect(ours?.publishedAt).toBeNull();
      expect(typeof ours?.occurredAt).toBe('string');
    });

    it('does not return entries that have already been published', async () => {
      if (!ctx.pool) return;

      const event = makeEvent();
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, event);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      await markPublished(ctx.pool, [event.id]);

      const all = await findUnpublished(ctx.pool, 100);
      expect(all.find((e) => e.id === event.id)).toBeUndefined();
    });
  });

  describe('markPublished', () => {
    it('is a no-op when no ids are provided', async () => {
      if (!ctx.pool) return;
      // Should not throw, should not affect any rows.
      await expect(markPublished(ctx.pool, [])).resolves.not.toThrow();
    });

    it('sets published_at on the matching rows', async () => {
      if (!ctx.pool) return;

      const a = makeEvent();
      const b = makeEvent();
      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, a);
        await insertOutboxEntry(client, b);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      await markPublished(ctx.pool, [a.id, b.id]);

      const { rows } = await ctx.pool.query<{ id: string; published_at: Date | null }>(
        'SELECT id, published_at FROM event_outbox WHERE id = ANY($1::uuid[])',
        [[a.id, b.id]],
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.published_at).not.toBeNull();
      }
    });
  });

  describe('pruneOlderThan', () => {
    it('deletes only rows older than the cutoff and reports the count', async () => {
      if (!ctx.pool) return;

      const old = makeEvent({
        occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const recent = makeEvent();

      const client = await ctx.pool.connect();
      try {
        await client.query('BEGIN');
        await insertOutboxEntry(client, old);
        await insertOutboxEntry(client, recent);
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const deleted = await pruneOlderThan(ctx.pool, 7);
      expect(deleted).toBeGreaterThanOrEqual(1);

      const { rows } = await ctx.pool.query<{ id: string }>(
        'SELECT id FROM event_outbox WHERE id = $1',
        [old.id],
      );
      expect(rows).toHaveLength(0);

      const { rows: stillThere } = await ctx.pool.query<{ id: string }>(
        'SELECT id FROM event_outbox WHERE id = $1',
        [recent.id],
      );
      expect(stillThere).toHaveLength(1);
    });
  });
});
