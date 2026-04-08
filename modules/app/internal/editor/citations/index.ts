/** Contract: contracts/app/rules.md */
export { CitationMark } from './citation-mark.ts';
export { openCitationPicker, closeCitationPicker } from './citation-picker.ts';
export {
  formatInlineCitation,
  formatBibliographyEntry,
  formatCitation,
} from './citation-render.ts';
export type { CitationStyle } from './citation-render.ts';
export { createBibliography, getBibliographyHtml } from './bibliography.ts';
export type { BibliographyHandle } from './bibliography.ts';
export type {
  CitationAttrs,
  ReferenceData,
  ReferenceAuthor,
  FormattedCitation,
} from './types.ts';
export { buildReferenceLibrary } from './reference-library.ts';
