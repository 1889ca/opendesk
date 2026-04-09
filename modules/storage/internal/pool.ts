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

// Note: an earlier `getClientWithPrincipal()` helper used set_config
// with is_local=false, which leaks the setting across pool connection
// reuses. It was unused (issue #134 cleanup) and superseded by the
// transaction-scoped rls-query helper landed in #146.

/**
 * Backward-compatible `pool` export.
 * Proxies all property access to the lazily-created Pool instance,
 * so existing `import { pool }` code works without changes.
 *
 * This is no longer re-exported through `storage/index.ts` (issue
 * #134). Internal storage code and the composition root still use it,
 * and a small number of pg-* stores in other modules import it via
 * the cross-module-internal path. Converting those stores to true
 * dependency injection is tracked as a follow-up.
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
