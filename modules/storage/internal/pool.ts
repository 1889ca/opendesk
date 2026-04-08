/** Contract: contracts/storage/rules.md */
import pg from 'pg';
import type { PostgresConfig } from '../../config/index.ts';

let _pool: pg.Pool | null = null;
let _pgConfig: PostgresConfig | null = null;

/** Inject PostgresConfig from the composition root. Must be called before getPool(). */
export function initPool(config: PostgresConfig): void {
  _pgConfig = config;
}

/** Return the singleton pg.Pool, creating it lazily on first call. */
export function getPool(): pg.Pool {
  if (!_pool) {
    if (!_pgConfig) {
      throw new Error('initPool() must be called before getPool() — pass PostgresConfig from the composition root');
    }
    _pool = new pg.Pool({
      host: _pgConfig.host,
      port: _pgConfig.port,
      database: _pgConfig.database,
      user: _pgConfig.user,
      password: _pgConfig.password,
      max: _pgConfig.maxConnections,
    });
  }
  return _pool;
}

/**
 * Acquire a client from the pool with `app.principal_id` set for RLS.
 * Uses SET LOCAL so the setting is scoped to the current transaction.
 *
 * Usage:
 *   const client = await getClientWithPrincipal('user-123');
 *   try {
 *     await client.query('BEGIN');
 *     // ... your queries, RLS policies now filter by principal ...
 *     await client.query('COMMIT');
 *   } finally {
 *     client.release();
 *   }
 *
 * NOTE: SET LOCAL only takes effect inside a transaction block (BEGIN...COMMIT).
 * If you run queries outside a transaction, use `set_config` with is_local=false instead.
 */
export async function getClientWithPrincipal(principalId: string): Promise<pg.PoolClient> {
  const client = await getPool().connect();
  await client.query("SELECT set_config('app.principal_id', $1, false)", [principalId]);
  return client;
}

/**
 * Backward-compatible `pool` export.
 * Proxies all property access to the lazily-created Pool instance,
 * so existing `import { pool }` code works without changes.
 */
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    const real = getPool();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
  set(_target, prop, value) {
    return Reflect.set(getPool(), prop, value);
  },
});
