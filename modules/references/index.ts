/** Contract: contracts/references/rules.md */
export {
  // Schemas
  AuthorSchema,
  ReferenceTypeSchema,
  ReferenceSchema,
  ReferenceCreateInputSchema,
  ReferenceUpdateInputSchema,
  CitationAttrsSchema,
  DocumentCitationSchema,

  // Types
  type Author,
  type ReferenceType,
  type Reference,
  type ReferenceCreateInput,
  type ReferenceUpdateInput,
  type CitationAttrs,
  type DocumentCitation,

  // Constants
  REFERENCE_TYPES,
} from './contract.ts';

// Store factories (DI-friendly) — callers pass pool and get a store object
export { createReferencesStore } from './internal/pg-references.ts';
export type { ReferencesStore } from './internal/pg-references.ts';

export { createCitationsStore } from './internal/pg-citations.ts';
export type { CitationsStore } from './internal/pg-citations.ts';

// BibTeX import/export
export { parseBibTeX } from './internal/bibtex-parser.ts';
export { serializeBibTeX } from './internal/bibtex-serializer.ts';

// RIS import/export
export { parseRIS } from './internal/ris-parser.ts';
export { serializeRIS } from './internal/ris-serializer.ts';

// CSL-JSON import/export
export { parseCSLJSON } from './internal/csl-json-parser.ts';
export { serializeCSLJSON } from './internal/csl-json-serializer.ts';

// DOI / ISBN lookup
export { lookupDOI, lookupISBN } from './internal/doi-lookup.ts';
export type { LookupResult, LookupError, LookupResponse } from './internal/doi-lookup.ts';

// Library permissions
export {
  ensureLibraryGrant,
  checkLibraryAccess,
  LIBRARY_RESOURCE_TYPE,
} from './internal/library-permissions.ts';

// Route factories
export { createSearchRoutes } from './internal/reference-search-routes.ts';
export type { SearchRoutesOptions } from './internal/reference-search-routes.ts';
export { createBibliographyRoutes } from './internal/bibliography-routes.ts';
export type { BibliographyRoutesOptions } from './internal/bibliography-routes.ts';

// Row types (for consumers that need the DB shape)
export type { ReferenceRow, ReferenceUpdates } from './internal/pg-references.ts';
export type { DocumentCitationRow } from './internal/pg-citations.ts';
