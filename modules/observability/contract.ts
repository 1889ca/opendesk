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

// --- Module Interface ---

export interface ObservabilityModule {
  /** Record an HTTP request metric. */
  recordMetric(entry: Omit<MetricEntry, 'id' | 'timestamp'>): void;
  /** Get the current metrics summary. */
  getSummary(): Promise<MetricsSummary>;
  /** Get latest health indicators. */
  getHealth(): Promise<HealthIndicator[]>;
  /** Start the background health monitor. */
  startHealthMonitor(): void;
  /** Stop the background health monitor. */
  stopHealthMonitor(): void;
}

// --- Config ---

export const ObservabilityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sampleRate: z.coerce.number().min(0).max(1).default(1),
  healthIntervalMs: z.coerce.number().int().positive().default(60000),
});

export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
