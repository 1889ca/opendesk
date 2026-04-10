/** Contract: contracts/app/rules.md */

/**
 * Re-exports from doc-row.ts and doc-card.ts for backwards compatibility.
 * List rendering lives in doc-row.ts; grid rendering in doc-card.ts (issue #208).
 */

export { renderDocuments, TYPE_META } from './doc-row.ts';
export type { DocEntry, RenderDocumentsOptions } from './doc-row.ts';
export { renderDocumentsGrid } from './doc-card.ts';
export type { RenderDocumentsGridOptions } from './doc-card.ts';
