/** Contract: contracts/http/rules.md */

import type { HttpErrorCode, HttpFetchInit } from '../contract.ts';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Structured error for HTTP fetch failures.
 * Thrown on timeout or network-level errors — NOT on non-2xx responses
 * (callers inspect `response.ok` themselves).
 */
export class HttpFetchError extends Error {
  readonly code: HttpErrorCode;

  constructor(code: HttpErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HttpFetchError';
    this.code = code;
  }
}

/**
 * Fetch with automatic timeout and error normalization.
 *
 * - Applies a configurable timeout (default 30s) via AbortSignal.
 * - If the caller provides their own signal, both are honored (whichever fires first).
 * - Returns the raw Response on success (does NOT throw on non-2xx).
 * - Throws HttpFetchError with code 'TIMEOUT' or 'NETWORK_ERROR'.
 */
export async function httpFetch(
  url: string,
  init?: HttpFetchInit,
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Build a combined signal: timeout + optional caller signal
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const callerSignal = init?.signal;

  const signal = callerSignal
    ? AbortSignal.any([timeoutSignal, callerSignal])
    : timeoutSignal;

  // Strip our custom field before passing to native fetch
  const { timeoutMs: _stripped, ...fetchInit } = init ?? {};

  try {
    return await fetch(url, { ...fetchInit, signal });
  } catch (err) {
    if (isAbortError(err)) {
      // Distinguish timeout from caller-initiated abort
      if (timeoutSignal.aborted) {
        throw new HttpFetchError(
          'TIMEOUT',
          `Request timed out after ${timeoutMs}ms: ${url}`,
          { cause: err },
        );
      }
      // Caller's own signal aborted — re-throw as-is
      throw err;
    }

    throw new HttpFetchError(
      'NETWORK_ERROR',
      `Network error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof DOMException && err.name === 'TimeoutError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}
