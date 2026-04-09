/** Contract: contracts/observability/rules.md */

// Public contract for the observability module. Type definitions are
// split across modules/observability/contract/ to stay under the
// 200-line hard limit (issue #136); this file re-exports them and
// declares the ObservabilityModule interface that the implementation
// honors.

export {
  MetricEntrySchema,
  type MetricEntry,
  HealthIndicatorSchema,
  type HealthIndicator,
  OperationSummarySchema,
  type OperationSummary,
  MetricsSummarySchema,
  type MetricsSummary,
  TimeSeriesPointSchema,
  type TimeSeriesPoint,
  type MetricsFilter,
  ContentTypeSchema,
  type ContentType,
  MetricNameSchema,
  type MetricName,
  MetricSampleSchema,
  type MetricSample,
} from './contract/metrics-types.ts';

export {
  SeveritySchema,
  type Severity,
  AnomalyAlertSchema,
  type AnomalyAlert,
  ForensicsQuerySchema,
  type ForensicsQuery,
  ForensicsEventSchema,
  type ForensicsEvent,
} from './contract/anomaly-and-forensics-types.ts';

export {
  SiemFormatSchema,
  type SiemFormat,
  SiemConfigSchema,
  type SiemConfig,
  ObservabilityConfigSchema,
  type ObservabilityConfig,
} from './contract/siem-config-types.ts';

import type {
  MetricEntry,
  HealthIndicator,
  MetricsSummary,
  TimeSeriesPoint,
  MetricsFilter,
  MetricSample,
} from './contract/metrics-types.ts';
import type {
  AnomalyAlert,
  ForensicsQuery,
  ForensicsEvent,
} from './contract/anomaly-and-forensics-types.ts';
import type { SiemFormat } from './contract/siem-config-types.ts';

// --- Module Interface ---

export interface ObservabilityModule {
  /** Record an HTTP request metric. */
  recordMetric(entry: Omit<MetricEntry, 'id' | 'timestamp'>): void;
  /** Record a content metric sample. */
  record(sample: MetricSample): Promise<void>;
  /** Get the current metrics summary. */
  getSummary(): Promise<MetricsSummary>;
  /** Get latest health indicators. */
  getHealth(): Promise<HealthIndicator[]>;
  /** Get time-series data for charting. */
  getTimeSeries(rangeMinutes: number, filter?: MetricsFilter): Promise<TimeSeriesPoint[]>;
  /** Query time-series data by metric name and time range. */
  queryTimeSeries(metric: string, from: string, to: string, bucketSeconds?: number): Promise<unknown[]>;
  /** Search metrics by correlation ID. */
  searchByCorrelationId(correlationId: string): Promise<MetricEntry[]>;
  /** Run anomaly detection across all metrics. */
  detectAnomalies(): Promise<AnomalyAlert[]>;
  /** Acknowledge an anomaly alert. */
  acknowledgeAlert(id: string, userId: string): Promise<void>;
  /** Query forensics events. */
  queryForensics(query: ForensicsQuery): Promise<ForensicsEvent[]>;
  /** Export events in SIEM format. */
  exportSiem(format: SiemFormat, from: string, to: string): Promise<string>;
  /** Start the background health monitor. */
  startHealthMonitor(): void;
  /** Stop the background health monitor. */
  stopHealthMonitor(): void;
}
