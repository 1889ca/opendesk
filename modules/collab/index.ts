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
