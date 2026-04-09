/** Contract: contracts/observability/rules.md */
import { z } from 'zod';

// Core metric and health types: HTTP request metrics, system health
// indicators, summaries, and time-series points used by the metrics
// dashboard.
//
// Anomaly detection / forensics types live in anomaly-and-forensics-types.ts
// and SIEM export types live in siem-config-types.ts.

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

// --- Metric Sample ---

export const MetricSampleSchema = z.object({
  metric: MetricNameSchema,
  contentType: ContentTypeSchema,
  value: z.number(),
  timestamp: z.string(),
  tags: z.record(z.unknown()).optional(),
});
export type MetricSample = z.infer<typeof MetricSampleSchema>;
