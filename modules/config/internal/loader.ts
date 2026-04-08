/** Contract: contracts/config/rules.md */
import { AppConfigSchema, type AppConfig } from '../contract.ts';

/**
 * Read all environment variables and build the raw input
 * for Zod validation. Maps env var names to config shape.
 */
function readEnv(): unknown {
  const env = process.env;
  return {
    server: {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s: string) => s.trim()) : undefined,
    },
    auth: {
      mode: env.AUTH_MODE,
      oidcIssuer: env.OIDC_ISSUER,
      oidcClientId: env.OIDC_CLIENT_ID,
      oidcAudience: env.OIDC_AUDIENCE || env.OIDC_CLIENT_ID,
    },
    postgres: {
      host: env.PG_HOST,
      port: env.PG_PORT,
      database: env.PG_DATABASE,
      user: env.PG_USER,
      password: env.PG_PASSWORD,
      maxConnections: env.PG_MAX_CONNECTIONS,
    },
    s3: {
      endpoint: env.S3_ENDPOINT,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
    },
    redis: {
      url: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
      maxRetries: env.REDIS_MAX_RETRIES,
      connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
    },
    collabora: {
      baseUrl: env.COLLABORA_URL,
      timeoutMs: env.COLLABORA_TIMEOUT_MS,
      flushTimeoutMs: env.FLUSH_TIMEOUT_MS,
    },
    audit: {
      hmacSecret: env.OPENDESK_AUDIT_HMAC_SECRET,
    },
    logger: {
      level: env.LOG_LEVEL,
    },
    observability: {
      enabled: env.OBSERVABILITY_ENABLED,
      sampleRate: env.OBSERVABILITY_SAMPLE_RATE,
      healthIntervalMs: env.OBSERVABILITY_HEALTH_INTERVAL_MS,
    },
    ai: {
      enabled: env.AI_ENABLED,
      ollamaUrl: env.AI_OLLAMA_URL,
      embeddingModel: env.AI_EMBEDDING_MODEL,
      chatModel: env.AI_CHAT_MODEL,
      chunkSize: env.AI_CHUNK_SIZE,
      chunkOverlap: env.AI_CHUNK_OVERLAP,
      embeddingDimensions: env.AI_EMBEDDING_DIMENSIONS,
    },
  };
}

/** Strip undefined values so Zod defaults apply correctly. */
function stripUndefined(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    result[key] = typeof value === 'object' && value !== null
      ? stripUndefined(value)
      : value;
  }
  return result;
}

/**
 * Validate production constraints that can't be expressed in Zod schema alone.
 * Throws on startup if violated.
 */
function validateProductionRules(config: AppConfig): void {
  const isProd = config.server.nodeEnv === 'production';
  if (!isProd) return;

  if (config.auth.mode === 'dev') {
    throw new Error(
      'FATAL: AUTH_MODE=dev is forbidden when NODE_ENV=production',
    );
  }
  if (config.postgres.password === 'opendesk_dev') {
    throw new Error('PG_PASSWORD must be set in production');
  }
  if (config.s3.accessKey === 'opendesk' || config.s3.secretKey === 'opendesk_dev') {
    throw new Error(
      'S3_ACCESS_KEY and S3_SECRET_KEY must be set in production',
    );
  }
  if (config.audit.hmacSecret.includes('dev-audit-secret')) {
    throw new Error('OPENDESK_AUDIT_HMAC_SECRET must be set in production');
  }
}

/**
 * Load and validate all configuration from environment variables.
 * Call once at startup — crashes immediately on invalid config.
 */
export function loadConfig(): AppConfig {
  const raw = stripUndefined(readEnv());
  const config = AppConfigSchema.parse(raw);
  validateProductionRules(config);
  return Object.freeze(config) as AppConfig;
}
