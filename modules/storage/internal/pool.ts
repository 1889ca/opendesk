/** Contract: contracts/storage/rules.md */
import pg from 'pg';
import { loadConfig } from '../../config/index.ts';

let _pool: pg.Pool | null = null;

// TODO: Thread PostgresConfig from composition root instead of calling loadConfig()
// internally. Requires refactoring the lazy Proxy + singleton pattern.
/** Return the singleton pg.Pool, creating it lazily on first call. */
export function getPool(): pg.Pool {
  if (!_pool) {
    const pgConfig = loadConfig().postgres;
    _pool = new pg.Pool({
      host: pgConfig.host,
      port: pgConfig.port,
      database: pgConfig.database,
      user: pgConfig.user,
      password: pgConfig.password,
      max: pgConfig.maxConnections,
    });
  }
  return _pool;
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
