/** Contract: contracts/app/comments.md */
import * as Y from 'yjs';
import type { CommentData, CommentChangeListener } from './types.ts';

/**
 * Manages comments in a Yjs-backed shared array.
 * All mutations sync automatically to connected collaborators.
 */
export class CommentStore {
  private readonly yArray: Y.Array<CommentData>;
  private readonly listeners: CommentChangeListener[] = [];

  constructor(ydoc: Y.Doc) {
    this.yArray = ydoc.getArray<CommentData>('comments');
    this.yArray.observe(() => this.notify());
  }

  /** Subscribe to changes. Returns unsubscribe function. */
  onChange(fn: CommentChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Get all comments for a document. */
  getComments(documentId: string): CommentData[] {
    return this.yArray
      .toArray()
      .filter((c) => c.documentId === documentId);
  }

  /** Get root comments (not replies) for a document, sorted by creation time. */
  getRootComments(documentId: string): CommentData[] {
    return this.getComments(documentId)
      .filter((c) => !c.parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Get replies to a specific comment. */
  getReplies(commentId: string): CommentData[] {
    return this.yArray
      .toArray()
      .filter((c) => c.parentId === commentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Find a comment by ID. */
  findById(id: string): CommentData | undefined {
    return this.yArray.toArray().find((c) => c.id === id);
  }

  /** Add a new root comment. Returns the comment ID. */
  addComment(data: Omit<CommentData, 'createdAt'>): string {
    const comment: CommentData = {
      ...data,
      threadId: data.threadId ?? data.id,
      createdAt: new Date().toISOString(),
    };
    this.yArray.push([comment]);
    return comment.id;
  }

  /** Add a reply to an existing comment. */
  addReply(
    parentId: string,
    data: Omit<CommentData, 'createdAt' | 'parentId' | 'threadId'>,
  ): string {
    const parent = this.findById(parentId);
    const threadId = parent?.threadId ?? parentId;
    const reply: CommentData = {
      ...data,
      parentId,
      threadId,
      createdAt: new Date().toISOString(),
    };
    this.yArray.push([reply]);
    return reply.id;
  }

  /** Mark a comment as resolved. */
  resolveComment(id: string): void {
    this.updateField(id, 'resolvedAt', new Date().toISOString());
  }

  /** Reopen a resolved comment. */
  reopenComment(id: string): void {
    this.updateField(id, 'resolvedAt', undefined);
  }

  /** Delete a comment and all its replies. */
  deleteComment(id: string): void {
    const idsToRemove = new Set([id]);
    // Collect reply IDs
    for (const c of this.yArray.toArray()) {
      if (c.parentId === id || c.threadId === id) {
        idsToRemove.add(c.id);
      }
    }
    // Remove in reverse order to keep indices stable
    for (let i = this.yArray.length - 1; i >= 0; i--) {
      if (idsToRemove.has(this.yArray.get(i).id)) {
        this.yArray.delete(i, 1);
      }
    }
  }

  private updateField<K extends keyof CommentData>(
    id: string,
    field: K,
    value: CommentData[K],
  ): void {
    for (let i = 0; i < this.yArray.length; i++) {
      const item = this.yArray.get(i);
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        this.yArray.delete(i, 1);
        this.yArray.insert(i, [updated]);
        return;
      }
    }
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
