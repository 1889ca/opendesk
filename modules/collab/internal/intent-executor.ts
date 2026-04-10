/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';
import { computeRevisionId } from './document-materializer.ts';
import { applyTextIntent } from './intent-executor-text.ts';
import { applySpreadsheetIntent } from './intent-executor-spreadsheet.ts';
import { applyPresentationIntent } from './intent-executor-presentation.ts';
import type { DocumentIntent, TextIntentAction } from '../../document/contract/index.ts';
import type { IntentResult, IntentSuccess, IntentConflict, DuplicateIntent } from '../contract.ts';

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface IntentExecutorDeps {
  /** Get a live Yjs document by ID, or null if not loaded in memory. */
  getDoc(docId: string): Y.Doc | null;
  /**
   * Flush the current Yjs state to storage, returning the new revisionId.
   * The materializer's flush method returns void, so we compute the revision
   * from the doc after the flush.
   */
  flush(docId: string, ydoc: Y.Doc): Promise<void>;
  /** Get the current revision ID for a document from the live Yjs state. */
  getCurrentRevisionId(docId: string): string | null;
}

// ---------------------------------------------------------------------------
// In-memory idempotency cache entry
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: IntentSuccess;
  expiresAt: number;
}

const IDEMPOTENCY_TTL_MS = 86_400_000; // 24 hours
const CACHE_MAX_SIZE = 1000;

// ---------------------------------------------------------------------------
// applyIntent dispatcher
// ---------------------------------------------------------------------------

function applyIntentAction(ydoc: Y.Doc, intent: DocumentIntent): number {
  const { action } = intent;
  const actionType = action.type;

  if (
    actionType === 'insert_block' ||
    actionType === 'update_block' ||
    actionType === 'delete_block' ||
    actionType === 'update_marks'
  ) {
    return applyTextIntent(ydoc, action as TextIntentAction);
  }

  if (
    actionType === 'update_cell' ||
    actionType === 'insert_row' ||
    actionType === 'delete_row' ||
    actionType === 'insert_column' ||
    actionType === 'delete_column' ||
    actionType === 'insert_sheet' ||
    actionType === 'delete_sheet' ||
    actionType === 'rename_sheet'
  ) {
    return applySpreadsheetIntent(ydoc, action as unknown as Record<string, unknown>);
  }

  if (
    actionType === 'insert_slide' ||
    actionType === 'delete_slide' ||
    actionType === 'reorder_slides' ||
    actionType === 'insert_element' ||
    actionType === 'update_element' ||
    actionType === 'delete_element'
  ) {
    return applyPresentationIntent(ydoc, action as unknown as Record<string, unknown>);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// createIntentExecutor
// ---------------------------------------------------------------------------

export function createIntentExecutor(deps: IntentExecutorDeps) {
  const cache = new Map<string, CacheEntry>();

  function pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    if (cache.size > CACHE_MAX_SIZE) {
      const toDelete = cache.size - CACHE_MAX_SIZE;
      let deleted = 0;
      for (const key of cache.keys()) {
        cache.delete(key);
        deleted++;
        if (deleted >= toDelete) break;
      }
    }
  }

  async function applyIntent(intent: DocumentIntent): Promise<IntentResult> {
    const { idempotencyKey, baseRevision, documentId } = intent;
    const now = Date.now();

    const cached = cache.get(idempotencyKey);
    if (cached) {
      if (cached.expiresAt > now) {
        return {
          code: 'DUPLICATE_INTENT',
          originalRevisionId: cached.result.revisionId,
        } satisfies DuplicateIntent;
      }
      cache.delete(idempotencyKey);
    }

    const ydoc = deps.getDoc(documentId);
    if (!ydoc) {
      throw new Error('document_not_loaded');
    }

    const currentRevisionId = deps.getCurrentRevisionId(documentId);
    if (currentRevisionId !== null && currentRevisionId !== baseRevision) {
      // Cast required: Y.encodeStateVector returns Uint8Array<ArrayBufferLike>
      // but IntentConflict schema expects Uint8Array<ArrayBuffer>.
      const currentStateVector = Y.encodeStateVector(ydoc) as unknown as Uint8Array<ArrayBuffer>;
      return {
        code: 'STALE_REVISION',
        baseRevision,
        currentRevision: currentRevisionId,
        currentStateVector,
      } satisfies IntentConflict;
    }

    let appliedOperations = 0;
    ydoc.transact(() => {
      appliedOperations = applyIntentAction(ydoc, intent);
    });

    await deps.flush(documentId, ydoc);
    const newStateVector = Y.encodeStateVector(ydoc);
    const revisionId = computeRevisionId(newStateVector);

    const result: IntentSuccess = { revisionId, appliedOperations };

    pruneCache();
    cache.set(idempotencyKey, { result, expiresAt: now + IDEMPOTENCY_TTL_MS });

    return result;
  }

  return { applyIntent };
}
