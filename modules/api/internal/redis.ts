/** Contract: contracts/api/rules.md */
import { Redis as IORedis } from 'ioredis';
import { loadConfig } from '../../config/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('redis');

type RedisInstance = IORedis;

export interface RedisConfig {
  url: string;
  /** Key prefix for all operations (default: 'opendesk:') */
  keyPrefix?: string;
  /** Max reconnection attempts before giving up (default: 20) */
  maxRetriesPerRequest?: number;
  /** Connection timeout in ms (default: 5000) */
  connectTimeout?: number;
}

/** Minimal interface for cache operations — allows in-memory substitution in tests. */
export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<string>;
  status: string;
}

function getDefaultConfig(): Partial<RedisConfig> {
  const rc = loadConfig().redis;
  return {
    url: rc.url,
    keyPrefix: rc.keyPrefix,
    maxRetriesPerRequest: rc.maxRetries,
    connectTimeout: rc.connectTimeoutMs,
  };
}

let sharedClient: RedisInstance | null = null;

/**
 * Creates and returns a Redis client with graceful reconnection handling.
 * Re-uses the same connection across the process.
 */
export function getRedisClient(config?: Partial<RedisConfig>): RedisInstance {
  if (sharedClient && sharedClient.status !== 'end') {
    return sharedClient;
  }

  const defaults = getDefaultConfig();
  const url = config?.url ?? defaults.url ?? 'redis://localhost:6379';
  const merged = { ...defaults, ...config, url };

  const client = new IORedis(merged.url, {
    keyPrefix: merged.keyPrefix,
    maxRetriesPerRequest: merged.maxRetriesPerRequest,
    connectTimeout: merged.connectTimeout,
    retryStrategy(times: number) {
      if (times > (merged.maxRetriesPerRequest ?? 20)) {
        log.error('giving up after max retries', { attempts: times });
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      log.warn('reconnecting', { delayMs: delay, attempt: times });
      return delay;
    },
    lazyConnect: false,
  });

  client.on('connect', () => log.info('connected'));
  client.on('error', (err: Error) => log.error('connection error', { error: err.message }));
  client.on('close', () => log.warn('connection closed'));

  sharedClient = client;
  return client;
}

/** Disconnect the shared client (for graceful shutdown). */
export async function disconnectRedis(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}

/** Reset shared client reference (for tests). */
export function resetRedisClient(): void {
  sharedClient = null;
}
