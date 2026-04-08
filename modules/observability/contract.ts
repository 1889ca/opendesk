/** Contract: contracts/observability/rules.md */
import { z } from 'zod';

// --- Content Type Dimension ---

export const ContentTypeSchema = z.enum(['document', 'sheet', 'slides', 'kb']);
export type ContentType = z.infer<typeof ContentTypeSchema>;

// --- Metric Registry ---

export const MetricNameSchema = z.enum([
  // Documents
  'document.edits_per_sec',
  'document.active_collaborators',
  'document.conversion_throughput',
  // Sheets
  'sheet.cell_updates_per_sec',
  'sheet.formula_evaluations',
  'sheet.active_users',
  // Slides
  'slides.element_mutations',
  'slides.presentation_views',
  'slides.export_count',
  // KB
  'kb.entry_creates',
  'kb.entry_updates',
  'kb.search_queries_per_sec',
  'kb.relationship_changes',
]);

export type MetricName = z.infer<typeof MetricNameSchema>;

// --- Metric Sample ---

export const MetricSampleSchema = z.object({
  metric: MetricNameSchema,
  contentType: ContentTypeSchema,
  value: z.number(),
  timestamp: z.string().datetime(),
  tags: z.record(z.string()).optional(),
});

export type MetricSample = z.infer<typeof MetricSampleSchema>;

// --- Time Series Bucket ---

export const TimeSeriesBucketSchema = z.object({
  bucket: z.string().datetime(),
  metric: MetricNameSchema,
  contentType: ContentTypeSchema,
  avg: z.number(),
  min: z.number(),
  max: z.number(),
  count: z.number(),
});

export type TimeSeriesBucket = z.infer<typeof TimeSeriesBucketSchema>;

// --- Anomaly Severity ---

export const SeveritySchema = z.enum(['info', 'warning', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

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
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
  acknowledgedBy: z.string().nullable(),
});

export type AnomalyAlert = z.infer<typeof AnomalyAlertSchema>;

// --- Forensics Query ---

export const ForensicsQuerySchema = z.object({
  contentType: ContentTypeSchema.optional(),
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export type ForensicsQuery = z.infer<typeof ForensicsQuerySchema>;

// --- Forensics Event ---

export const ForensicsEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  contentType: ContentTypeSchema,
  actorId: z.string(),
  actorType: z.enum(['human', 'agent', 'system']),
  action: z.string(),
  resourceId: z.string(),
  occurredAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type ForensicsEvent = z.infer<typeof ForensicsEventSchema>;

// --- SIEM Format ---

export const SiemFormatSchema = z.enum(['cef', 'syslog', 'jsonlines']);
export type SiemFormat = z.infer<typeof SiemFormatSchema>;

// --- SIEM Config ---

export const SiemConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  format: SiemFormatSchema,
  mode: z.enum(['push', 'pull']),
  endpoint: z.string().url().optional(),
  filters: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
});

export type SiemConfig = z.infer<typeof SiemConfigSchema>;

// --- Module Interface ---

export interface ObservabilityModule {
  /** Record a metric sample. */
  record(sample: MetricSample): Promise<void>;
  /** Query time-series buckets. */
  queryTimeSeries(
    metric: MetricName,
    from: string,
    to: string,
    bucketSeconds?: number,
  ): Promise<TimeSeriesBucket[]>;
  /** Run anomaly detection on recent data. */
  detectAnomalies(): Promise<AnomalyAlert[]>;
  /** Query forensics events. */
  queryForensics(query: ForensicsQuery): Promise<ForensicsEvent[]>;
  /** Acknowledge an anomaly alert. */
  acknowledgeAlert(id: string, userId: string): Promise<void>;
  /** Export events in SIEM format. */
  exportSiem(
    format: SiemFormat,
    from: string,
    to: string,
  ): Promise<string>;
}
