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

export type { DocumentRow, DocumentType, ListDocumentsOptions, ListDocumentsResult, SortField, SortDir } from './internal/pg.ts';

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
// Issue #134: pool / getPool are no longer exported through the public
// surface — the storage contract forbids exposing adapter internals.
// initPool is kept because the composition root must call it once at
// startup to inject the PostgresConfig before any module reads from
// the database. The composition root and existing internal stores
// import the pool directly from ./internal/pool.ts; that
// cross-module-internal access is a known smaller smell tracked as a
// follow-up to #134 (the proper fix is converting each store to a
// factory that takes pool as a parameter).
export { initPool } from './internal/pool.ts';

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
