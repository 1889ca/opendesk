/** Contract: contracts/api/rules.md */
import { z } from 'zod';

// --- Actor Type ---

export const ActorTypeSchema = z.enum(['human', 'agent']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

// --- Rate Limit Config (discriminated by actorType) ---

const baseRateLimit = {
  sustainedPerSec: z.number().positive(),
  burstSize: z.number().int().positive(),
};

export const RateLimitConfigSchema = z.discriminatedUnion('actorType', [
  z.object({
    actorType: z.literal('human'),
    ...baseRateLimit,
  }),
  z.object({
    actorType: z.literal('agent'),
    ...baseRateLimit,
  }),
]);

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// --- API Config ---

export const ApiConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  corsOrigins: z.array(z.string().url()).default([]),
  rateLimits: z.object({
    human: z.object({
      sustainedPerSec: z.number().positive().default(10),
      burstSize: z.number().int().positive().default(30),
    }),
    agent: z.object({
      sustainedPerSec: z.number().positive().default(2),
      burstSize: z.number().int().positive().default(5),
    }),
  }),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

// --- Causal Read Header ---

export const CausalReadHeaderSchema = z.object({
  ifMatch: z.string().optional(),
});

export type CausalReadHeader = z.infer<typeof CausalReadHeaderSchema>;

// --- SSE Connection Config ---

export const SSEConnectionConfigSchema = z.object({
  lastEventId: z.string().optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
});

export type SSEConnectionConfig = z.infer<typeof SSEConnectionConfigSchema>;

// --- Pagination ---

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// --- Error Response ---

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// --- Outbox TTL ---

export const OUTBOX_TTL_DAYS = 7 as const;
