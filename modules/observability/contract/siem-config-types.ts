/** Contract: contracts/observability/rules.md */
import { z } from 'zod';

// SIEM export configuration and the observability module's own
// runtime config schema.

// --- SIEM Format ---

export const SiemFormatSchema = z.enum(['cef', 'syslog', 'jsonlines']);
export type SiemFormat = z.infer<typeof SiemFormatSchema>;

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

// --- Observability Module Config ---

export const ObservabilityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sampleRate: z.coerce.number().min(0).max(1).default(1),
  healthIntervalMs: z.coerce.number().int().positive().default(60000),
});

export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
