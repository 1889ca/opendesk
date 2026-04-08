/** Contract: contracts/events/rules.md */
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { findUnpublished, markPublished } from './outbox-store.ts';
import { publishToStream } from './redis-streams.ts';
import type { EventType } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('events:poller');

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 100;

export interface OutboxPollerHandle {
  stop(): void;
}

/**
 * Start a background poller that finds unpublished outbox entries
 * and publishes them to Redis Streams. Handles Redis failures gracefully.
 */
export function startOutboxPoller(
  pool: Pool,
  redis: Redis,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
): OutboxPollerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll() {
    try {
      const entries = await findUnpublished(pool, DEFAULT_BATCH_SIZE);
      if (entries.length === 0) return;

      const publishedIds: string[] = [];
      for (const entry of entries) {
        try {
          await publishToStream(redis, {
            ...entry,
            type: entry.type as EventType,
          });
          publishedIds.push(entry.id);
        } catch (err) {
          log.warn('failed to publish entry', { entryId: entry.id, error: String(err) });
          break; // Stop batch on first Redis failure
        }
      }
      if (publishedIds.length > 0) {
        await markPublished(pool, publishedIds);
      }
    } catch (err) {
      log.error('poll cycle failed', { error: String(err) });
    }
  }

  timer = setInterval(poll, intervalMs);
  // Run immediately on start
  poll();

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
