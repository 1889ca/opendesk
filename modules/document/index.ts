/** Contract: contracts/document/rules.md */

// Schemas (Zod)
export {
  TextSchemaVersionSchema,
  ProseMirrorNodeSchema,
  ProseMirrorJSONSchema,
  MarkSchema,
  TextDocumentSnapshotSchema,
  DocumentSnapshotSchema,
  RevisionIdSchema,
  MarkSpecSchema,
  InsertBlockIntentSchema,
  UpdateBlockIntentSchema,
  DeleteBlockIntentSchema,
  UpdateMarksIntentSchema,
  IntentActionSchema,
  DocumentIntentSchema,
} from './contract.ts';

// Types
export type {
  ProseMirrorNode,
  ProseMirrorJSON,
  TextDocumentSnapshot,
  DocumentSnapshot,
  RevisionId,
  MarkSpec,
  IntentAction,
  DocumentIntent,
  Migration,
} from './contract.ts';

// Enums
export { TextSchemaVersion } from './contract.ts';

// Pure functions
export { migrateToLatest } from './internal/migrations.ts';
export { computeRevisionId } from './internal/revision.ts';
