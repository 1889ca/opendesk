/** Contract: contracts/events/rules.md */
import type { Pool } from 'pg';
import { pruneOlderThan } from './outbox-store.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('events:pruner');

const DEFAULT_PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RETENTION_DAYS = 7;

export interface PrunerHandle {
  stop(): void;
}

/** Start a background job that prunes outbox entries older than 7 days. */
export function startPruner(
  pool: Pool,
  intervalMs = DEFAULT_PRUNE_INTERVAL_MS,
): PrunerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function prune() {
    try {
      const count = await pruneOlderThan(pool, RETENTION_DAYS);
      if (count > 0) {
        log.info('pruned outbox entries', { count, retentionDays: RETENTION_DAYS });
      }
    } catch (err) {
      log.error('prune cycle failed', { error: String(err) });
    }
  }

  timer = setInterval(prune, intervalMs);

  return {
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
