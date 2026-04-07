/** Contract: contracts/storage/rules.md */
export {
  StorageTier,
  StorageTierSchema,
  SnapshotReadResultSchema,
  SaveSnapshotParamsSchema,
  SaveYjsBinaryParamsSchema,
  STATE_VECTOR_PRUNE_THRESHOLD_DAYS,
} from './contract.ts';

export type {
  SnapshotReadResult,
  SaveSnapshotParams,
  SaveYjsBinaryParams,
  DocumentRepository,
} from './contract.ts';

// Public API — database operations
export {
  listDocuments,
  createDocument,
  getDocument,
  deleteDocument,
  updateDocumentTitle,
  saveYjsState,
  loadYjsState,
} from './internal/pg.ts';

export type { DocumentRow } from './internal/pg.ts';

// Template storage
export type { TemplateRow, TemplateUpdates } from './internal/templates.ts';

export {
  CREATE_TEMPLATES_TABLE,
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from './internal/templates.ts';

export { defaultTemplates } from './internal/default-templates.ts';
export type { DefaultTemplate } from './internal/default-templates.ts';
