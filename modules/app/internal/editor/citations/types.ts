/** Contract: contracts/app/rules.md */

export interface CitationAttrs {
  referenceId: string;
  locator?: string;
  prefix?: string;
  suffix?: string;
  noteIndex?: number;
}

export interface ReferenceAuthor {
  given?: string;
  family?: string;
  literal?: string;
}

export interface ReferenceData {
  id: string;
  type: string;
  title: string;
  authors: ReferenceAuthor[];
  issuedDate?: string;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
}

export interface FormattedCitation {
  inline: string;
  bibliography: string;
}
