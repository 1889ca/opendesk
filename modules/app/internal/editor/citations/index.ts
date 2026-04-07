/** Contract: contracts/app/rules.md */
export { CitationMark } from './citation-mark.ts';
export { openCitationPicker, closeCitationPicker } from './citation-picker.ts';
export {
  formatInlineCitation,
  formatBibliographyEntry,
  formatCitation,
} from './citation-render.ts';
export type {
  CitationAttrs,
  ReferenceData,
  ReferenceAuthor,
  FormattedCitation,
} from './types.ts';
