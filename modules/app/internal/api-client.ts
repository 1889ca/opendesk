/** Contract: contracts/app/rules.md */

/**
 * Shared API client that adds authentication headers to all requests.
 * In dev mode (AUTH_MODE=dev), uses a static Bearer token.
 * In production, this would use OIDC tokens from the session.
 */

const DEV_TOKEN = 'dev';

function getAuthToken(): string {
  // In production, retrieve from session/cookie/OIDC flow
  // For now, use the dev token
  return localStorage.getItem('opendesk-auth-token') || DEV_TOKEN;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAuthToken()}`,
  };
}

/**
 * Authenticated fetch wrapper. Adds Authorization header automatically.
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
  return fetch(url, { ...init, headers });
}
