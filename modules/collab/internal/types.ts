/** Contract: contracts/collab/rules.md */

import type { TokenVerifier } from '../../auth/contract.ts';

/**
 * External dependencies injected into the collab module.
 * Keeps module boundaries clean — collab never imports auth internals.
 */
export type CollabDependencies = {
  /** Verifies bearer tokens and resolves them to a Principal. */
  tokenVerifier: TokenVerifier;
};
