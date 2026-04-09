/** Contract: contracts/config/rules.md */
import { z } from 'zod';

const AuthModeSchema = z.enum(['oidc', 'dev']);

export const AuthConfigSchema = z.object({
  mode: AuthModeSchema.default('oidc'),
  oidcIssuer: z.string().default(''),
  oidcClientId: z.string().default(''),
  oidcAudience: z.string().default(''),
});

export const PostgresConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().int().positive().default(5433),
  database: z.string().default('opendesk'),
  user: z.string().default('opendesk'),
  password: z.string().default('opendesk_dev'),
  maxConnections: z.coerce.number().int().positive().default(10),
});

export const S3ConfigSchema = z.object({
  endpoint: z.string().default('http://localhost:9000'),
  accessKey: z.string().default('opendesk'),
  secretKey: z.string().default('opendesk_dev'),
  bucket: z.string().default('opendesk'),
  region: z.string().default('us-east-1'),
});

export const RedisConfigSchema = z.object({
  url: z.string().default('redis://localhost:6379'),
  keyPrefix: z.string().default('opendesk:'),
  maxRetries: z.coerce.number().int().nonnegative().default(20),
  connectTimeoutMs: z.coerce.number().int().positive().default(5000),
});

export const CollaboraConfigSchema = z.object({
  baseUrl: z.string().default('http://localhost:9980'),
  timeoutMs: z.coerce.number().int().positive().default(30000),
  flushTimeoutMs: z.coerce.number().int().positive().default(10000),
});

export const ServerConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.string().default('development'),
  corsOrigins: z.array(z.string()).default([]),
});

export const AuditConfigSchema = z.object({
  hmacSecret: z.string().min(32).default('dev-audit-secret-must-change-in-prod-32chars'),
});

export const LoggerConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const ObservabilityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sampleRate: z.coerce.number().min(0).max(1).default(1),
  healthIntervalMs: z.coerce.number().int().positive().default(60000),
});

export const AiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ollamaUrl: z.string().default('http://localhost:11434'),
  embeddingModel: z.string().default('all-minilm'),
  chatModel: z.string().default('llama3.2'),
  chunkSize: z.coerce.number().int().positive().default(512),
  chunkOverlap: z.coerce.number().int().nonnegative().default(64),
  embeddingDimensions: z.coerce.number().int().positive().default(384),
});

export const AppConfigSchema = z.object({
  server: ServerConfigSchema,
  auth: AuthConfigSchema,
  postgres: PostgresConfigSchema,
  s3: S3ConfigSchema,
  redis: RedisConfigSchema,
  collabora: CollaboraConfigSchema,
  audit: AuditConfigSchema,
  logger: LoggerConfigSchema,
  observability: ObservabilityConfigSchema,
  ai: AiConfigSchema,
  federation: z.object({
    enabled: z.boolean().default(false),
    instanceId: z.string().default(''),
    privateKey: z.string().default(''),
    publicKey: z.string().default(''),
    /**
     * Allow federation peers whose hostname resolves to RFC1918
     * (10/8, 172.16/12, 192.168/16) or IPv6 ULA addresses. Required
     * for self-hosted instances on a LAN. Loopback and link-local are
     * always forbidden regardless. See issue #131.
     */
    allowPrivateNetworks: z.coerce.boolean().default(false),
    /**
     * Allow http:// and ws:// federation peer URLs (in addition to
     * https:// and wss://). Off by default; intended for tests and
     * local development. Production federation traffic must be
     * encrypted.
     */
    allowInsecureSchemes: z.coerce.boolean().default(false),
  }),
});

export type AuthMode = z.infer<typeof AuthModeSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type PostgresConfig = z.infer<typeof PostgresConfigSchema>;
export type S3Config = z.infer<typeof S3ConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type CollaboraConfig = z.infer<typeof CollaboraConfigSchema>;
export type AuditConfig = z.infer<typeof AuditConfigSchema>;
export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type AiConfig = z.infer<typeof AiConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
