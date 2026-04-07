/** Contract: contracts/app/suggestions.md */

/** Attributes stored on suggestion marks in the document. */
export interface SuggestionAttrs {
  /** Unique ID for this suggestion group. */
  suggestionId: string;
  /** User ID of the author. */
  authorId: string;
  /** Display name of the author. */
  authorName: string;
  /** Author's assigned color. */
  authorColor: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

/** A resolved suggestion with its position in the document. */
export interface SuggestionEntry {
  /** The suggestion ID. */
  id: string;
  /** Type of suggestion. */
  type: 'insert' | 'delete';
  /** The suggested text content. */
  text: string;
  /** Author display name. */
  authorName: string;
  /** Author color. */
  authorColor: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Start position in the document. */
  from: number;
  /** End position in the document. */
  to: number;
}
