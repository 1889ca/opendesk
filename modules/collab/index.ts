/** Contract: contracts/collab/rules.md */
export type {
  IntentConflict,
  DuplicateIntent,
  IntentSuccess,
  IntentResult,
  IntentExecutor,
  MaterializerConfig,
  CollabConfig,
  UpgradeHandler,
  CollabServer,
  GrantRevokedHandler,
} from './contract.ts';

export {
  IntentConflictSchema,
  DuplicateIntentSchema,
  IntentSuccessSchema,
  MaterializerConfigSchema,
  CollabConfigSchema,
} from './contract.ts';

// Public API — collab server
export { createCollabServer } from './internal/server.ts';

// Public API — purge compaction
export { compactDocument, needsCompaction } from './internal/purge-compaction.ts';
export type { CompactionResult } from './internal/purge-compaction.ts';

// Public API — intent executor (AI-assisted editing)
export { createIntentExecutor } from './internal/intent-executor.ts';
export type { IntentExecutorDeps } from './internal/intent-executor.ts';

// Public API — document materializer (Yjs → snapshot persistence)
export {
  createDocumentMaterializer,
  computeRevisionId,
} from './internal/document-materializer.ts';
export type { DocumentMaterializer, MaterializerOptions } from './internal/document-materializer.ts';

// Public API — grant-revoked handler (disconnect WebSocket on access revocation)
export {
  subscribeGrantRevoked,
  HocuspocusConnectionFinder,
  InMemoryConnectionFinder,
  GRANT_REVOKED_CLOSE_CODE,
  GRANT_REVOKED_CLOSE_REASON,
} from './internal/grant-revoked-handler.ts';
export type { ConnectionFinder } from './internal/grant-revoked-handler.ts';
