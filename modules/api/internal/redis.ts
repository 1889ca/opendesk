/** Contract: contracts/api/rules.md */
import { Redis as IORedis } from 'ioredis';

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

const DEFAULT_CONFIG: Partial<RedisConfig> = {
  keyPrefix: 'opendesk:',
  maxRetriesPerRequest: 20,
  connectTimeout: 5000,
};

let sharedClient: RedisInstance | null = null;

/**
 * Creates and returns a Redis client with graceful reconnection handling.
 * Re-uses the same connection across the process.
 */
export function getRedisClient(config?: Partial<RedisConfig>): RedisInstance {
  if (sharedClient && sharedClient.status !== 'end') {
    return sharedClient;
  }

  const url = config?.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const merged = { ...DEFAULT_CONFIG, ...config, url };

  const client = new IORedis(merged.url, {
    keyPrefix: merged.keyPrefix,
    maxRetriesPerRequest: merged.maxRetriesPerRequest,
    connectTimeout: merged.connectTimeout,
    retryStrategy(times: number) {
      if (times > (merged.maxRetriesPerRequest ?? 20)) {
        console.error(`[redis] giving up after ${times} retries`);
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      console.warn(`[redis] reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    lazyConnect: false,
  });

  client.on('connect', () => console.log('[redis] connected'));
  client.on('error', (err: Error) => console.error('[redis] error:', err.message));
  client.on('close', () => console.warn('[redis] connection closed'));

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
