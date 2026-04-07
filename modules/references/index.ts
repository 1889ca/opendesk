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

// Reference CRUD
export {
  createReference,
  getReference,
  listReferences,
  updateReference,
  deleteReference,
  findByDOI,
} from './internal/pg-references.ts';

// Citation tracking
export {
  linkCitation,
  unlinkCitation,
  listCitationsForDocument,
  listDocumentsForReference,
} from './internal/pg-citations.ts';

// BibTeX import/export
export { parseBibTeX } from './internal/bibtex-parser.ts';
export { serializeBibTeX } from './internal/bibtex-serializer.ts';

// RIS import/export
export { parseRIS } from './internal/ris-parser.ts';
export { serializeRIS } from './internal/ris-serializer.ts';
