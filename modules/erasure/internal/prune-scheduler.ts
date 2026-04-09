/** Contract: contracts/erasure/rules.md */

import type { ErasureModule } from '../contract.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('erasure:scheduler');

export type SchedulerConfig = {
  /** Cron-compatible interval in milliseconds. */
  intervalMs: number;
  /** Actor ID used for attestation records. */
  systemActorId: string;
};

/**
 * Cron-compatible scheduler for automated retention policy pruning.
 * Runs all enabled policies at a configurable interval.
 */
export function createPruneScheduler(
  erasureModule: ErasureModule,
  config: SchedulerConfig,
) {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function runCycle(): Promise<void> {
    log.info('prune cycle starting');

    const policies = await erasureModule.listPolicies();
    const enabled = policies.filter((p) => p.enabled);

    for (const policy of enabled) {
      try {
        const preview = await erasureModule.previewPrune(policy.id);
        if (preview.wouldDelete === 0) {
          log.info('no entries to prune', { policyId: policy.id, name: policy.name });
          continue;
        }

        log.info('pruning entries', {
          policyId: policy.id,
          name: policy.name,
          count: preview.wouldDelete,
        });

        const result = await erasureModule.executePrune(policy.id, config.systemActorId);
        log.info('prune completed', {
          policyId: policy.id,
          deleted: result.deleted,
        });
      } catch (err) {
        log.error('prune failed for policy', {
          policyId: policy.id,
          error: String(err),
        });
      }
    }

    log.info('prune cycle completed');
  }

  return {
    start(): void {
      if (timer) return;
      log.info('scheduler started', { intervalMs: config.intervalMs });
      timer = setInterval(() => {
        runCycle().catch((err) => {
          log.error('prune cycle error', { error: String(err) });
        });
      }, config.intervalMs);
    },

    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
        log.info('scheduler stopped');
      }
    },

    /** Run a single cycle on demand (for testing or manual triggers). */
    runOnce: runCycle,
  };
}
