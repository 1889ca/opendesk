/** Contract: contracts/observability/rules.md */
import type { Pool } from 'pg';
import type { HealthIndicator } from '../contract.ts';
import { insertHealthIndicators } from './metric-store.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('observability:health');

export interface HealthMonitorDeps {
  pool: Pool;
  intervalMs: number;
}

/**
 * Periodically probes system health and records indicators.
 * Each probe is wrapped in try/catch — failures produce 'critical' status, never throw.
 */
export function createHealthMonitor(deps: HealthMonitorDeps) {
  const { pool, intervalMs } = deps;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function probe(): Promise<void> {
    const indicators: HealthIndicator[] = [];
    const now = new Date().toISOString();

    // 1. Database latency
    try {
      const start = process.hrtime.bigint();
      await pool.query('SELECT 1');
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      indicators.push({
        name: 'database.latency_ms',
        value: Math.round(ms * 100) / 100,
        unit: 'ms',
        status: ms < 100 ? 'ok' : ms < 500 ? 'warning' : 'critical',
        timestamp: now,
      });
    } catch {
      indicators.push({
        name: 'database.latency_ms',
        value: -1,
        unit: 'ms',
        status: 'critical',
        timestamp: now,
      });
    }

    // 2. Database pool utilization
    try {
      const total = pool.totalCount;
      const idle = pool.idleCount;
      const waiting = pool.waitingCount;
      const utilization = total > 0 ? ((total - idle) / total) * 100 : 0;
      indicators.push({
        name: 'database.pool_utilization',
        value: Math.round(utilization),
        unit: 'percent',
        status: utilization < 70 ? 'ok' : utilization < 90 ? 'warning' : 'critical',
        timestamp: now,
      });
      indicators.push({
        name: 'database.pool_waiting',
        value: waiting,
        unit: 'connections',
        status: waiting === 0 ? 'ok' : waiting < 5 ? 'warning' : 'critical',
        timestamp: now,
      });
    } catch {
      indicators.push({
        name: 'database.pool_utilization',
        value: -1,
        unit: 'percent',
        status: 'critical',
        timestamp: now,
      });
    }

    // 3. Process memory
    const mem = process.memoryUsage();
    const heapMb = Math.round(mem.heapUsed / 1048576);
    indicators.push({
      name: 'process.heap_mb',
      value: heapMb,
      unit: 'mb',
      status: heapMb < 512 ? 'ok' : heapMb < 1024 ? 'warning' : 'critical',
      timestamp: now,
    });

    // 4. Process uptime
    indicators.push({
      name: 'process.uptime_s',
      value: Math.round(process.uptime()),
      unit: 'seconds',
      status: 'ok',
      timestamp: now,
    });

    // Persist indicators
    try {
      await insertHealthIndicators(pool, indicators);
    } catch (err) {
      log.error('failed to persist health indicators', { error: String(err) });
    }
  }

  return {
    start() {
      if (timer) return;
      probe(); // Run immediately on start
      timer = setInterval(probe, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    /** Run a single probe (for testing). */
    probe,
  };
}
