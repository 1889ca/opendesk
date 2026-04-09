/** Contract: contracts/app-kb/rules.md */

// Public API — used by app module (promote-to-kb, shell route)
export { createEntryApi, fetchEntries } from './internal/kb-api.ts';
export type { KBEntryRecord } from './internal/kb-api.ts';

// View module — dynamically imported by app shell
export { mount, unmount } from './internal/kb-browser-view.ts';
