/** Contract: contracts/app/rules.md */

/**
 * Shared API client that adds authentication headers to all requests.
 * In dev mode (AUTH_MODE=dev), builds a structured token:
 *   dev:<stableId>:<displayName>:*
 * which the server's dev-verifier can decode into a real identity.
 * In production, this would use OIDC tokens from the session.
 *
 * Issue #170: wire anonymous localStorage identity into auth token.
 */

const DEV_FALLBACK = 'dev';

export function getAuthToken(): string {
  // In production, retrieve from session/cookie/OIDC flow
  try {
    const stableId = localStorage.getItem('opendesk:anonToken');
    const displayName = localStorage.getItem('opendesk:userName');
    if (stableId && displayName) {
      // Sanitise: strip colons from name so the token format stays parseable
      const safeName = displayName.replace(/:/g, '-');
      return `dev:${stableId}:${safeName}:*`;
    }
  } catch {
    // localStorage unavailable (e.g. private browsing with strict settings)
  }
  return DEV_FALLBACK;
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
