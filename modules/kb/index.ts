/** Contract: contracts/kb/rules.md */

// --- Schemas ---
export {
  KbEntryStatusSchema,
  KbEntrySchema,
  KbEntryCreateInputSchema,
  KbEntryUpdateInputSchema,
  KbEntryVersionSchema,
  KbVersionRefSchema,
  ResolvedReferenceSchema,
  KB_ENTRY_STATUSES,
  STATUS_TRANSITIONS,
} from './contract.ts';

// --- Types ---
export type {
  KbEntryStatus,
  KbEntry,
  KbEntryCreateInput,
  KbEntryUpdateInput,
  KbEntryVersion,
  KbVersionRef,
  ResolvedReference,
} from './contract.ts';

// --- Entry CRUD ---
export {
  createEntry,
  getEntry,
  listEntries,
  listPublishedEntries,
  updateEntry,
  transitionStatus,
  deleteEntry,
} from './internal/pg-entries.ts';

export type { KbEntryRow, KbEntryFields } from './internal/pg-entries.ts';

// --- Version history ---
export {
  getVersion as getEntryVersion,
  getLatestVersion,
  listVersions as listEntryVersions,
} from './internal/pg-versions.ts';

export type { KbVersionRow } from './internal/pg-versions.ts';

// --- Lifecycle ---
export { validateTransition, isPubliclyAvailable } from './internal/lifecycle.ts';
export type { TransitionResult, TransitionError, TransitionSuccess } from './internal/lifecycle.ts';

// --- Reference resolution ---
export { parseKbUri, buildKbUri, resolveReference } from './internal/resolve-ref.ts';
export type { ResolveResult, ResolveError, ResolveSuccess } from './internal/resolve-ref.ts';
