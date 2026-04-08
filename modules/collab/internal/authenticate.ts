/** Contract: contracts/collab/rules.md */

import type { onAuthenticatePayload } from '@hocuspocus/server';
import type { TokenVerifier } from '../../auth/contract.ts';

/**
 * Creates the Hocuspocus onAuthenticate hook.
 *
 * Verifies the bearer token provided by the client and stores
 * the resolved Principal in the connection context. Throws on
 * invalid or missing tokens, which causes Hocuspocus to reject
 * the connection before the handshake completes.
 *
 * Token source: `data.token` — the standard Hocuspocus provider token
 * field, sent in the WebSocket handshake body.
 *
 * Query-string tokens are intentionally rejected to prevent token
 * leakage via proxy logs, browser history, and Referer headers.
 */
export function createOnAuthenticate(tokenVerifier: TokenVerifier) {
  return async (data: onAuthenticatePayload) => {
    const token = data.token || '';

    if (!token) {
      throw new Error('No authentication token provided');
    }

    const result = await tokenVerifier.verifyToken(token);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    // Return the principal as context — Hocuspocus merges this
    // into the connection context for downstream hooks.
    return { principal: result.principal };
  };
}
