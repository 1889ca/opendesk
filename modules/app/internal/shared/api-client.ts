/** Contract: contracts/app/rules.md */

/**
 * Shared API client that adds authentication headers to all requests.
 * In dev mode (AUTH_MODE=dev), uses a static Bearer token.
 * In production, this would use OIDC tokens from the session.
 */

const DEV_TOKEN = 'dev';

export function getAuthToken(): string {
  // In production, retrieve from session/cookie/OIDC flow
  // For now, use the dev token
  return localStorage.getItem('opendesk-auth-token') || DEV_TOKEN;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAuthToken()}`,
  };
}

/** Methods that require an idempotency key header. */
const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'DELETE']);

/** Generate a unique idempotency key using crypto.randomUUID. */
function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Authenticated fetch wrapper. Adds Authorization header automatically.
 * For mutating requests (POST/PUT/DELETE), auto-generates an idempotency-key
 * header if one is not already present.
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const auth = authHeaders();
  for (const [key, value] of Object.entries(auth)) {
    if (!headers.has(key)) headers.set(key, value);
  }

  const method = (init?.method ?? 'GET').toUpperCase();
  if (IDEMPOTENT_METHODS.has(method) && !headers.has('idempotency-key')) {
    headers.set('idempotency-key', generateIdempotencyKey());
  }

  return fetch(url, { ...init, headers });
}
