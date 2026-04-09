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

export type { DocumentRow, DocumentType } from './internal/pg.ts';

// Template storage
export type { TemplateRow, TemplateUpdates } from './internal/templates.ts';

export {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from './internal/templates.ts';

export { defaultTemplates } from './internal/default-templates.ts';
export type { DefaultTemplate } from './internal/default-templates.ts';

// Version history
export type { VersionRow } from './internal/pg-versions.ts';

export {
  saveVersion,
  listVersions,
  getVersion,
  deleteVersion as deleteVersionRecord,
} from './internal/pg-versions.ts';

// Search
export type { SearchResult } from './internal/pg-search.ts';

export {
  APPLY_SEARCH_SCHEMA,
  searchDocuments,
} from './internal/pg-search.ts';

// Global cross-type search
export type { GlobalSearchResult, ContentType } from './internal/pg-global-search.ts';
export { globalSearch } from './internal/pg-global-search.ts';

// Schema initialization and pool (for server startup)
export { initSchema } from './internal/schema.ts';
export { pool, getPool, initPool, getClientWithPrincipal } from './internal/pool.ts';

// RLS principal context (issue #126)
export {
  runWithPrincipal,
  runAsSystem,
  getCurrentPrincipal,
  SYSTEM_PRINCIPAL,
  type PrincipalContext,
} from './internal/principal-context.ts';
export { rlsQuery } from './internal/rls-query.ts';
export { principalContextMiddleware } from './internal/principal-context-middleware.ts';

// Folder storage
export type { FolderRow } from './internal/folders.ts';

export {
  createFolder,
  listFolders,
  renameFolder,
  getFolder,
  deleteFolder,
  moveDocument,
} from './internal/folders.ts';
