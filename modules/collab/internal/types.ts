/** Contract: contracts/collab/rules.md */

import type { TokenVerifier } from '../../auth/contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

/**
 * External dependencies injected into the collab module.
 * Keeps module boundaries clean — collab never imports auth/permissions internals.
 */
export type CollabDependencies = {
  /** Verifies bearer tokens and resolves them to a Principal. */
  tokenVerifier: TokenVerifier;
  /**
   * Permissions module — used by the WS authenticate hook to gate
   * document access (issue #125 / CRIT-1). Without this, any
   * authenticated user could read/write any document's CRDT state.
   */
  permissions: PermissionsModule;
};
