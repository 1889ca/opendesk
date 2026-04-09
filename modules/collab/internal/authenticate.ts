/** Contract: contracts/collab/rules.md */

import type { onAuthenticatePayload } from '@hocuspocus/server';
import type { TokenVerifier } from '../../auth/contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

/**
 * Creates the Hocuspocus onAuthenticate hook.
 *
 * Two-stage gate (issue #125 / CRIT-1):
 *
 * 1. Verifies the bearer token provided by the client and resolves
 *    it to a Principal. Invalid/missing tokens reject the connection
 *    before the WS handshake completes.
 *
 * 2. Checks `read` permission for the requested `documentName`. If
 *    the principal has no read access, the connection is rejected.
 *    If the principal has read but not write access, the connection
 *    is marked `readOnly: true` so Hocuspocus drops any updates the
 *    client tries to apply.
 *
 * Token source: `data.token` — the standard Hocuspocus provider token
 * field, sent in the WebSocket handshake body.
 *
 * Query-string tokens are intentionally rejected to prevent token
 * leakage via proxy logs, browser history, and Referer headers.
 */
export function createOnAuthenticate(
  tokenVerifier: TokenVerifier,
  permissions: PermissionsModule,
) {
  return async (data: onAuthenticatePayload) => {
    const token = data.token || '';

    if (!token) {
      throw new Error('No authentication token provided');
    }

    const result = await tokenVerifier.verifyToken(token);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const principal = result.principal;
    const documentName = data.documentName;

    // Stage 2: gate on document read access.
    const canRead = await permissions.checkPermission(
      principal.id,
      documentName,
      'read',
      'document',
    );

    if (!canRead) {
      throw new Error('Forbidden: no read access to document');
    }

    const canWrite = await permissions.checkPermission(
      principal.id,
      documentName,
      'write',
      'document',
    );

    // Hocuspocus merges this object into the connection context.
    // `readOnly: true` causes Hocuspocus to drop client-originated
    // updates instead of broadcasting them.
    return {
      principal,
      readOnly: !canWrite,
    };
  };
}
