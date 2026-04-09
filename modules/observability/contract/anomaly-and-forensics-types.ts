/** Contract: contracts/observability/rules.md */
import { z } from 'zod';
import { ContentTypeSchema, MetricNameSchema } from './metrics-types.ts';

// Anomaly detection (z-score / rate-of-change alerts on the metric
// stream) and forensics (queryable event log for incident review).
// Both depend on ContentType and MetricName from metrics-types.ts.

// --- Severity ---

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
