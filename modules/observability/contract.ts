/** Contract: contracts/observability/rules.md */
import { z } from 'zod';

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- MetricEntry ---

export const MetricEntrySchema = z.object({
  id: z.string().regex(uuidv4Regex),
  correlationId: z.string().regex(uuidv4Regex),
  service: z.string().min(1),
  operation: z.string().min(1),
  durationMs: z.number().nonnegative(),
  statusCode: z.number().int().optional(),
  actorId: z.string().optional(),
  actorType: z.enum(['human', 'agent', 'system']).optional(),
  tags: z.record(z.unknown()).default({}),
  timestamp: z.string(),
});

export type MetricEntry = z.infer<typeof MetricEntrySchema>;

// --- HealthIndicator ---

export const HealthIndicatorSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  status: z.enum(['ok', 'warning', 'critical']),
  timestamp: z.string(),
});

export type HealthIndicator = z.infer<typeof HealthIndicatorSchema>;

// --- MetricsSummary (returned by /api/admin/metrics) ---

export const OperationSummarySchema = z.object({
  operation: z.string(),
  count: z.number().int(),
  avgDurationMs: z.number(),
  p95DurationMs: z.number(),
  p99DurationMs: z.number(),
  errorCount: z.number().int(),
});

export type OperationSummary = z.infer<typeof OperationSummarySchema>;

export const MetricsSummarySchema = z.object({
  timestamp: z.string(),
  uptime: z.number(),
  health: z.array(HealthIndicatorSchema),
  operations: z.array(OperationSummarySchema),
});

export type MetricsSummary = z.infer<typeof MetricsSummarySchema>;

// --- TimeSeriesPoint (bucketed metrics for charting) ---

export const TimeSeriesPointSchema = z.object({
  bucket: z.string(),
  requestCount: z.number().int(),
  errorCount: z.number().int(),
  avgDurationMs: z.number(),
  p50DurationMs: z.number(),
  p95DurationMs: z.number(),
  p99DurationMs: z.number(),
});

export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;

// --- MetricsFilter ---

export interface MetricsFilter {
  operation?: string;
  statusCode?: number;
  actorType?: 'human' | 'agent' | 'system';
}

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

// --- Content Type & Metric Name ---

export const ContentTypeSchema = z.enum(['document', 'sheet', 'slides', 'kb']);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const MetricNameSchema = z.enum([
  'document.edits_per_sec',
  'document.active_sessions',
  'document.sync_latency_ms',
  'sheet.cell_updates_per_sec',
  'sheet.formula_eval_ms',
  'sheet.active_sessions',
  'slides.transitions_per_sec',
  'slides.active_sessions',
  'kb.queries_per_sec',
  'kb.index_latency_ms',
]);
export type MetricName = z.infer<typeof MetricNameSchema>;

// --- Severity ---

export const SeveritySchema = z.enum(['info', 'warning', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

// --- SIEM Format ---

export const SiemFormatSchema = z.enum(['cef', 'syslog', 'jsonlines']);
export type SiemFormat = z.infer<typeof SiemFormatSchema>;

// --- Metric Sample ---

export const MetricSampleSchema = z.object({
  metric: MetricNameSchema,
  contentType: ContentTypeSchema,
  value: z.number(),
  timestamp: z.string(),
  tags: z.record(z.unknown()).optional(),
});
export type MetricSample = z.infer<typeof MetricSampleSchema>;

// --- Anomaly Alert ---

export const AnomalyAlertSchema = z.object({
  id: z.string().uuid(),
  metric: MetricNameSchema,
  contentType: ContentTypeSchema,
  value: z.number(),
  threshold: z.number(),
  severity: SeveritySchema,
  detectionType: z.enum(['zscore', 'rate_of_change']),
  message: z.string(),
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedBy: z.string().nullable(),
});
export type AnomalyAlert = z.infer<typeof AnomalyAlertSchema>;

// --- Forensics ---

export const ForensicsQuerySchema = z.object({
  contentType: ContentTypeSchema.optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type ForensicsQuery = z.infer<typeof ForensicsQuerySchema>;

export const ForensicsEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  contentType: ContentTypeSchema,
  actorId: z.string(),
  actorType: z.enum(['human', 'agent', 'system']),
  action: z.string(),
  resourceId: z.string(),
  occurredAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type ForensicsEvent = z.infer<typeof ForensicsEventSchema>;

// --- SIEM Config ---

export const SiemConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  format: SiemFormatSchema,
  mode: z.enum(['push', 'pull']),
  endpoint: z.string().url().optional(),
  filters: z.record(z.string()).optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
});
export type SiemConfig = z.infer<typeof SiemConfigSchema>;

// --- Config ---

export const ObservabilityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sampleRate: z.coerce.number().min(0).max(1).default(1),
  healthIntervalMs: z.coerce.number().int().positive().default(60000),
});

export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
