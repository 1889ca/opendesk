/** Contract: contracts/storage/rules.md */

import type { Pool, QueryResult, QueryResultRow } from 'pg';
import { getCurrentPrincipal } from './principal-context.ts';

/**
 * RLS-aware query helper for grants and share_links (issue #126).
 *
 * Wraps a single query in a transaction so `SET LOCAL app.principal_id`
 * actually takes effect. Reads the principal id from
 * AsyncLocalStorage (see principal-context.ts).
 *
 * Why a transaction per query: SET LOCAL is scoped to the current
 * transaction. Without BEGIN/COMMIT around it, the setting is lost
 * before the query runs. The cost is one extra round-trip per query
 * (BEGIN + SET LOCAL + query + COMMIT instead of just query). Grants
 * and share_links are low-volume tables relative to documents, so
 * the extra latency is acceptable for the correctness gain.
 *
 * Future optimization: hold one client per HTTP request, BEGIN once
 * at request start, run all queries on that client, COMMIT at end.
 * That requires changing the store interfaces to take a client.
 *
 * Throws if called outside any principal context — use runWithPrincipal
 * (per-request user context) or runAsSystem (background jobs).
 */
export async function rlsQuery<R extends QueryResultRow = QueryResultRow>(
  pool: Pool,
  text: string,
  values?: unknown[],
): Promise<QueryResult<R>> {
  const ctx = getCurrentPrincipal();
  if (!ctx) {
    throw new Error(
      'rlsQuery called outside any principal context. ' +
      'Wrap the call in runWithPrincipal(id, fn) or runAsSystem(fn).',
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.principal_id', $1, true)", [ctx.principalId]);
    const result = await client.query<R>(text, values);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors — the original error is what matters.
    }
    throw err;
  } finally {
    client.release();
  }
}
