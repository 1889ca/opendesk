/** Contract: contracts/app/rules.md */

/**
 * Re-exports from doc-row.ts for backwards compatibility.
 * All rendering logic lives in doc-row.ts (issues #173, #182).
 */

export { renderDocuments, TYPE_META } from './doc-row.ts';
export type { DocEntry, RenderDocumentsOptions } from './doc-row.ts';
