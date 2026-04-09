/** Contract: contracts/storage/rules.md */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request principal context (issue #126).
 *
 * The Postgres RLS policies on `grants` and `share_links` filter rows
 * by `current_setting('app.principal_id')`. To make those policies
 * effective, every query against those tables must run inside a
 * transaction with `SET LOCAL app.principal_id = '<id>'` issued
 * first. The principal id is threaded through the request lifecycle
 * via AsyncLocalStorage so the rls-query helper can read it without
 * every store method needing an extra parameter.
 *
 * Three states:
 *
 * 1. **User context** — set by an Express middleware on every
 *    authenticated request: `runWithPrincipal(req.principal.id, () =>
 *    next())`. RLS sees the user's id; queries return only rows the
 *    user is permitted to see.
 *
 * 2. **System context** — for background jobs, retention sweeps,
 *    federation sync, etc. that legitimately need to read all rows.
 *    `runAsSystem(() => job())` sets a sentinel id of `__system__`
 *    which the RLS policies whitelist as a bypass.
 *
 * 3. **Unset** — outside any context. Reading from getCurrentPrincipal
 *    returns null, and rls-query treats this as a configuration bug
 *    (throws). Code paths that read grants/share_links must always
 *    enter one of the two contexts above.
 */

export type PrincipalContext = {
  principalId: string;
  isSystem: boolean;
};

const SYSTEM_PRINCIPAL_ID = '__system__';

const storage = new AsyncLocalStorage<PrincipalContext>();

/** Run `fn` with the user principal context set to `principalId`. */
export function runWithPrincipal<T>(principalId: string, fn: () => Promise<T> | T): Promise<T> | T {
  if (!principalId || principalId === SYSTEM_PRINCIPAL_ID) {
    throw new Error(
      `runWithPrincipal: invalid principalId '${principalId}'. Use runAsSystem() for system contexts.`,
    );
  }
  return storage.run({ principalId, isSystem: false }, fn);
}

/**
 * Run `fn` with the system principal context. Use this for background
 * jobs, scheduled sweeps, and admin tooling that needs to read across
 * all users' grants/share_links. The RLS policies whitelist the
 * `__system__` sentinel.
 */
export function runAsSystem<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run({ principalId: SYSTEM_PRINCIPAL_ID, isSystem: true }, fn);
}

/** Returns the current principal context, or null if outside any context. */
export function getCurrentPrincipal(): PrincipalContext | null {
  return storage.getStore() ?? null;
}

/** Sentinel id used by runAsSystem and the matching RLS bypass. */
export const SYSTEM_PRINCIPAL = SYSTEM_PRINCIPAL_ID;
