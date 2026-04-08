/** Contract: contracts/config/rules.md */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './loader.ts';

/**
 * Capture all config-related env vars so we can restore them after each test.
 * We directly manipulate process.env rather than using vi.mock().
 */
const CONFIG_ENV_KEYS = [
  'PORT', 'NODE_ENV', 'CORS_ORIGINS',
  'AUTH_MODE', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_AUDIENCE',
  'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD', 'PG_MAX_CONNECTIONS',
  'S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'S3_REGION',
  'REDIS_URL', 'REDIS_KEY_PREFIX', 'REDIS_MAX_RETRIES', 'REDIS_CONNECT_TIMEOUT_MS',
  'COLLABORA_URL', 'COLLABORA_TIMEOUT_MS', 'FLUSH_TIMEOUT_MS',
  'OPENDESK_AUDIT_HMAC_SECRET',
] as const;

let savedEnv: Record<string, string | undefined> = {};

function clearConfigEnv() {
  for (const key of CONFIG_ENV_KEYS) {
    delete process.env[key];
  }
}

describe('loadConfig', () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of CONFIG_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    clearConfigEnv();
  });

  afterEach(() => {
    for (const key of CONFIG_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('loads successfully with all defaults (dev mode)', () => {
    const config = loadConfig();

    expect(config.server.port).toBe(3000);
    expect(config.server.nodeEnv).toBe('development');
    expect(config.server.corsOrigins).toEqual([]);
    expect(config.auth.mode).toBe('oidc');
    expect(config.postgres.host).toBe('localhost');
    expect(config.postgres.port).toBe(5433);
    expect(config.postgres.password).toBe('opendesk_dev');
    expect(config.s3.endpoint).toBe('http://localhost:9000');
    expect(config.redis.url).toBe('redis://localhost:6379');
    expect(config.collabora.baseUrl).toBe('http://localhost:9980');
  });

  it('returns a frozen config object', () => {
    const config = loadConfig();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('applies custom env var overrides', () => {
    process.env.PORT = '8080';
    process.env.PG_HOST = 'db.prod.internal';
    process.env.PG_PORT = '5432';
    process.env.S3_BUCKET = 'my-bucket';
    process.env.REDIS_URL = 'redis://redis.prod:6380';

    const config = loadConfig();

    expect(config.server.port).toBe(8080);
    expect(config.postgres.host).toBe('db.prod.internal');
    expect(config.postgres.port).toBe(5432);
    expect(config.s3.bucket).toBe('my-bucket');
    expect(config.redis.url).toBe('redis://redis.prod:6380');
  });

  it('parses CORS_ORIGINS as comma-separated list', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com, https://admin.example.com';

    const config = loadConfig();

    expect(config.server.corsOrigins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('falls back OIDC_AUDIENCE to OIDC_CLIENT_ID when not set', () => {
    process.env.OIDC_CLIENT_ID = 'my-client';

    const config = loadConfig();

    expect(config.auth.oidcAudience).toBe('my-client');
  });

  it('uses AUTH_MODE=dev in development', () => {
    process.env.AUTH_MODE = 'dev';

    const config = loadConfig();

    expect(config.auth.mode).toBe('dev');
  });

  it('rejects AUTH_MODE=dev in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_MODE = 'dev';
    process.env.PG_PASSWORD = 'real-password';
    process.env.S3_ACCESS_KEY = 'AKIAEXAMPLE';
    process.env.S3_SECRET_KEY = 'real-secret';
    process.env.OPENDESK_AUDIT_HMAC_SECRET =
      'a]3kf9!mZpQ7rT$xW2vY&bN8cE0gH5jL';

    expect(() => loadConfig()).toThrow(
      'AUTH_MODE=dev is forbidden when NODE_ENV=production',
    );
  });

  it('rejects default PG password in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.S3_ACCESS_KEY = 'AKIAEXAMPLE';
    process.env.S3_SECRET_KEY = 'real-secret';
    process.env.OPENDESK_AUDIT_HMAC_SECRET =
      'a]3kf9!mZpQ7rT$xW2vY&bN8cE0gH5jL';

    expect(() => loadConfig()).toThrow(
      'PG_PASSWORD must be set in production',
    );
  });

  it('rejects default S3 credentials in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PG_PASSWORD = 'real-password';
    process.env.OPENDESK_AUDIT_HMAC_SECRET =
      'a]3kf9!mZpQ7rT$xW2vY&bN8cE0gH5jL';

    expect(() => loadConfig()).toThrow(
      'S3_ACCESS_KEY and S3_SECRET_KEY must be set in production',
    );
  });

  it('rejects default audit HMAC secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PG_PASSWORD = 'real-password';
    process.env.S3_ACCESS_KEY = 'AKIAEXAMPLE';
    process.env.S3_SECRET_KEY = 'real-secret';

    expect(() => loadConfig()).toThrow(
      'OPENDESK_AUDIT_HMAC_SECRET must be set in production',
    );
  });

  it('succeeds in production with all secrets set', () => {
    process.env.NODE_ENV = 'production';
    process.env.PG_PASSWORD = 'real-password';
    process.env.S3_ACCESS_KEY = 'AKIAEXAMPLE';
    process.env.S3_SECRET_KEY = 'real-secret';
    process.env.OPENDESK_AUDIT_HMAC_SECRET =
      'a]3kf9!mZpQ7rT$xW2vY&bN8cE0gH5jL';

    const config = loadConfig();

    expect(config.server.nodeEnv).toBe('production');
    expect(config.auth.mode).toBe('oidc');
  });

  it('rejects invalid AUTH_MODE values via Zod', () => {
    process.env.AUTH_MODE = 'bogus';

    expect(() => loadConfig()).toThrow();
  });

  it('coerces numeric env vars', () => {
    process.env.PG_MAX_CONNECTIONS = '25';
    process.env.COLLABORA_TIMEOUT_MS = '60000';
    process.env.REDIS_MAX_RETRIES = '5';

    const config = loadConfig();

    expect(config.postgres.maxConnections).toBe(25);
    expect(config.collabora.timeoutMs).toBe(60000);
    expect(config.redis.maxRetries).toBe(5);
  });
});
