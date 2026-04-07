/** Contract: contracts/collab/rules.md */

import type { TokenVerifier } from '../../auth/contract.ts';

/**
 * Creates the Hocuspocus onAuthenticate hook.
 *
 * Verifies the bearer token provided by the client and stores
 * the resolved Principal in the connection context. Throws on
 * invalid or missing tokens, which causes Hocuspocus to reject
 * the connection before the handshake completes.
 *
 * Token sources (checked in order):
 * 1. `data.token` — the standard Hocuspocus provider token field
 * 2. Query string `?token=xxx` on the upgrade URL
 */
export function createOnAuthenticate(tokenVerifier: TokenVerifier) {
  return async (data: {
    token: string;
    documentName: string;
    connection: { readOnly: boolean };
    requestHeaders: Record<string, string>;
    requestParameters: URLSearchParams;
  }) => {
    const token =
      data.token ||
      data.requestParameters.get('token') ||
      '';

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
