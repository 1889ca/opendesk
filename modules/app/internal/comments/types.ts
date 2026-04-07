/** Contract: contracts/app/comments.md */

/** A single comment or reply in a document. */
export interface CommentData {
  /** Unique identifier for this comment. */
  id: string;
  /** The document this comment belongs to. */
  documentId: string;
  /** The comment text content. */
  content: string;
  /** Display name of the author. */
  author: string;
  /** Author's assigned color. */
  authorColor: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of resolution, if resolved. */
  resolvedAt?: string;
  /** Thread group ID (matches the root comment's id). */
  threadId?: string;
  /** Parent comment ID for replies. */
  parentId?: string;
}

/** Callback for comment store change events. */
export type CommentChangeListener = () => void;
