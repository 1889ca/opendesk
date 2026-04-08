/** Contract: contracts/observability/rules.md */

import type { Pool } from 'pg';
import type {
  ObservabilityModule,
  MetricSample,
  MetricName,
  TimeSeriesBucket,
  ForensicsQuery,
  ForensicsEvent,
  AnomalyAlert,
  SiemFormat,
} from '../contract.ts';
import { MetricSampleSchema } from '../contract.ts';
import { insertSample, queryBuckets } from './metric-store.ts';
import { acknowledgeAlert as ackAlert } from './alert-store.ts';
import { detectAnomalies } from './anomaly-detector.ts';
import { queryForensics } from './forensics-store.ts';
import { formatEvents } from './siem-formatter.ts';

export type ObservabilityDependencies = {
  pool: Pool;
};

/** Create the observability module with all sub-capabilities. */
export function createObservability(deps: ObservabilityDependencies): ObservabilityModule {
  const { pool } = deps;

  return {
    async record(sample: MetricSample): Promise<void> {
      MetricSampleSchema.parse(sample);
      await insertSample(pool, sample);
    },

    async queryTimeSeries(
      metric: MetricName,
      from: string,
      to: string,
      bucketSeconds = 300,
    ): Promise<TimeSeriesBucket[]> {
      return queryBuckets(pool, metric, from, to, bucketSeconds);
    },

    async detectAnomalies(): Promise<AnomalyAlert[]> {
      return detectAnomalies(pool);
    },

    async queryForensics(query: ForensicsQuery): Promise<ForensicsEvent[]> {
      return queryForensics(pool, query);
    },

    async acknowledgeAlert(id: string, userId: string): Promise<void> {
      const updated = await ackAlert(pool, id, userId);
      if (!updated) {
        throw new Error(`Alert ${id} not found or already acknowledged`);
      }
    },

    async exportSiem(
      format: SiemFormat,
      from: string,
      to: string,
    ): Promise<string> {
      const events = await queryForensics(pool, { from, to, limit: 10000 });
      return formatEvents(events, format);
    },
  };
}
