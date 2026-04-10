/** Contract: contracts/collab/rules.md */

import type { TokenVerifier } from '../../auth/contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import type { EventBus } from '../../events/index.ts';
import type { DocumentRepository } from '../../storage/contract.ts';
import type { JournalStore } from './journal-store.ts';

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
  /**
   * Event bus — used to subscribe to GrantRevoked events so that
   * the collab server can disconnect revoked users (issue #307).
   * Optional: when omitted, grant-revoked disconnection and
   * materializer event emission are disabled.
   */
  eventBus?: EventBus;
  /**
   * Document repository — used by the materializer to persist snapshots.
   * Optional: when omitted, snapshot materialisation is disabled.
   */
  repo?: DocumentRepository;
  /**
   * Write-ahead operation journal — used for crash recovery.
   * Every Yjs update is appended here before being applied in-memory.
   * On document load, unmerged journal entries are replayed so no
   * updates are lost between materializer flushes.
   * Optional: when omitted, crash recovery journalling is disabled.
   */
  journalStore?: JournalStore;
};
