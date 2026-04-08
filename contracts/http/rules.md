# Contract: HTTP

## Purpose

Centralized server-side HTTP fetch helper with configurable timeout and consistent error normalization. Thin wrapper around native `fetch()` — no retry logic, no caching, no auth.

## Inputs

- `httpFetch(url: string, init?: HttpFetchInit)`: Fetch with timeout and error normalization.
- `HttpFetchInit` extends `RequestInit` with optional `timeoutMs` (default: 30000).

## Outputs

- Returns a standard `Response` on success.
- Throws `HttpFetchError` on network failure or timeout, with `code`, `message`, and optional `statusCode`.

## Side Effects

- Makes outbound HTTP requests.

## Invariants

- Every request has a timeout (default 30s, configurable per-call).
- Timeout uses `AbortSignal.timeout()` merged with any caller-provided signal.
- `HttpFetchError` always includes a `code` field: `'TIMEOUT'`, `'NETWORK_ERROR'`, or `'HTTP_ERROR'`.
- The helper never swallows errors — it normalizes and re-throws.
- No retry logic. Callers handle retries if needed.
- No authentication headers. Callers add their own.

## Dependencies

- None (uses native `fetch` and `AbortSignal`).

## Boundary Rules

- MUST: apply a timeout to every request.
- MUST: throw `HttpFetchError` with structured `code` for all failure modes.
- MUST NOT: add authentication, caching, or retry logic.
- MUST NOT: import external npm packages.
- MUST NOT: be used in browser-side code (use `modules/app/internal/shared/api-client.ts` instead).

## Verification

- Timeout triggers abort after configured duration -> Unit test with short timeout.
- Network errors produce `NETWORK_ERROR` code -> Unit test with invalid URL.
- Non-ok responses can be detected by caller (helper returns Response, does not throw on non-2xx).
