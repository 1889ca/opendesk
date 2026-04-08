/** Contract: contracts/observability/rules.md */
import type { Pool } from 'pg';
import type { MetricEntry, MetricsSummary, HealthIndicator, ObservabilityModule } from '../contract.ts';
import { insertMetric, getOperationSummaries, getLatestHealthIndicators } from './metric-store.ts';
import { createHealthMonitor } from './health-monitor.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('observability');

export interface ObservabilityDependencies {
  pool: Pool;
  healthIntervalMs?: number;
}

const startTime = Date.now();

/**
 * Factory: create the observability module.
 * Metric writes are fire-and-forget to avoid blocking request processing.
 */
export function createObservability(deps: ObservabilityDependencies): ObservabilityModule {
  const { pool } = deps;
  const healthIntervalMs = deps.healthIntervalMs ?? 60_000;

  const monitor = createHealthMonitor({ pool, intervalMs: healthIntervalMs });

  function recordMetric(entry: Omit<MetricEntry, 'id' | 'timestamp'>): void {
    insertMetric(pool, entry).catch((err) => {
      log.error('failed to record metric', { error: String(err) });
    });
  }

  async function getSummary(): Promise<MetricsSummary> {
    const [operations, health] = await Promise.all([
      getOperationSummaries(pool),
      getLatestHealthIndicators(pool),
    ]);

    return {
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - startTime) / 1000,
      health,
      operations,
    };
  }

  async function getHealth(): Promise<HealthIndicator[]> {
    return getLatestHealthIndicators(pool);
  }

  return {
    recordMetric,
    getSummary,
    getHealth,
    startHealthMonitor: () => monitor.start(),
    stopHealthMonitor: () => monitor.stop(),
  };
}
