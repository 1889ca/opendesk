/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';
import { computeRevisionId } from './document-materializer.ts';
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
// Text intent application helpers
// ---------------------------------------------------------------------------

function applyTextIntent(ydoc: Y.Doc, action: TextIntentAction): number {
  const fragment = ydoc.getXmlFragment('default');

  if (action.type === 'insert_block') {
    const newBlock = new Y.XmlElement(action.blockType);
    // Generate a blockId for the new block if not provided
    const blockId = action.attrs?.blockId ?? crypto.randomUUID();
    const attrs: Record<string, unknown> = { ...(action.attrs ?? {}), blockId };
    for (const [key, val] of Object.entries(attrs)) {
      newBlock.setAttribute(key, String(val));
    }
    if (action.content) {
      const textNode = new Y.XmlText();
      textNode.insert(0, action.content);
      newBlock.insert(0, [textNode]);
    }

    if (action.afterBlockId === null) {
      // Insert at beginning
      fragment.insert(0, [newBlock]);
    } else {
      // Find the block with the matching blockId
      const children = fragment.toArray();
      const idx = children.findIndex((child) => {
        const el = child as Y.XmlElement;
        return el.getAttribute?.('blockId') === action.afterBlockId;
      });
      if (idx === -1) {
        throw new Error(`block_not_found:${action.afterBlockId}`);
      }
      fragment.insert(idx + 1, [newBlock]);
    }
    return 1;
  }

  if (action.type === 'update_block') {
    const children = fragment.toArray();
    const el = children.find((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    }) as Y.XmlElement | undefined;
    if (!el) throw new Error(`block_not_found:${action.blockId}`);

    // Replace all text content in the block
    const textChildren = el.toArray();
    for (const child of textChildren) {
      if (child instanceof Y.XmlText) {
        const len = child.length;
        if (len > 0) child.delete(0, len);
        child.insert(0, action.content);
        return 1;
      }
    }
    // No existing text node — create one
    const textNode = new Y.XmlText();
    textNode.insert(0, action.content);
    el.insert(0, [textNode]);
    return 1;
  }

  if (action.type === 'delete_block') {
    const children = fragment.toArray();
    const idx = children.findIndex((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    });
    if (idx === -1) throw new Error(`block_not_found:${action.blockId}`);
    fragment.delete(idx, 1);
    return 1;
  }

  if (action.type === 'update_marks') {
    // Mark updates require text-level access. Find the block, then apply
    // format attributes to the XmlText within the specified range.
    const children = fragment.toArray();
    const el = children.find((child) => {
      return (child as Y.XmlElement).getAttribute?.('blockId') === action.blockId;
    }) as Y.XmlElement | undefined;
    if (!el) throw new Error(`block_not_found:${action.blockId}`);

    const textChildren = el.toArray();
    for (const child of textChildren) {
      if (child instanceof Y.XmlText) {
        const attrs: Record<string, unknown> = {};
        for (const mark of action.marks) {
          attrs[mark.type] = action.action === 'add' ? (mark.attrs ?? true) : null;
        }
        child.format(action.range.start, action.range.end - action.range.start, attrs);
        return 1;
      }
    }
    return 0;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Spreadsheet intent application helpers
// ---------------------------------------------------------------------------

function applySpreadsheetIntent(ydoc: Y.Doc, action: Record<string, unknown>): number {
  // Spreadsheet state is stored as a Y.Map named 'spreadsheet'
  const sheetsMap = ydoc.getMap<Y.Array<Y.Map<unknown>>>('spreadsheet');

  const type = action.type as string;
  const sheetIndex = action.sheet as number | undefined;

  let sheets = sheetsMap.get('sheets') as Y.Array<Y.Map<unknown>> | undefined;
  if (!sheets) {
    sheets = new Y.Array();
    sheetsMap.set('sheets', sheets);
  }

  if (type === 'insert_sheet') {
    const newSheet = new Y.Map<unknown>();
    newSheet.set('name', action.name as string);
    newSheet.set('rows', new Y.Array());
    newSheet.set('columns', new Y.Array());
    const after = action.afterSheet as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    sheets.insert(insertIdx, [newSheet]);
    return 1;
  }

  if (type === 'delete_sheet' && sheetIndex !== undefined) {
    sheets.delete(sheetIndex, 1);
    return 1;
  }

  if (type === 'rename_sheet' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    sheet.set('name', action.name as string);
    return 1;
  }

  if (type === 'update_cell' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    const rowIndex = action.row as number;
    const colIndex = action.col as number;
    const row = rows.get(rowIndex) as Y.Array<Y.Map<unknown>> | undefined;
    if (!row) throw new Error(`row_not_found:${rowIndex}`);
    const cell = row.get(colIndex) as Y.Map<unknown> | undefined;
    if (!cell) throw new Error(`cell_not_found:${colIndex}`);
    cell.set('value', action.value);
    if (action.formula !== undefined) cell.set('formula', action.formula);
    return 1;
  }

  if (type === 'insert_row' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    const newRow = new Y.Array<Y.Map<unknown>>();
    const after = action.afterRow as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    rows.insert(insertIdx, [newRow]);
    return 1;
  }

  if (type === 'delete_row' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const rows = sheet.get('rows') as Y.Array<Y.Array<Y.Map<unknown>>>;
    rows.delete(action.row as number, 1);
    return 1;
  }

  if (type === 'insert_column' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const columns = sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    const newCol = new Y.Map<unknown>();
    const after = action.afterCol as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    columns.insert(insertIdx, [newCol]);
    return 1;
  }

  if (type === 'delete_column' && sheetIndex !== undefined) {
    const sheet = sheets.get(sheetIndex) as Y.Map<unknown> | undefined;
    if (!sheet) throw new Error(`sheet_not_found:${sheetIndex}`);
    const columns = sheet.get('columns') as Y.Array<Y.Map<unknown>>;
    columns.delete(action.col as number, 1);
    return 1;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Presentation intent application helpers
// ---------------------------------------------------------------------------

function applyPresentationIntent(ydoc: Y.Doc, action: Record<string, unknown>): number {
  const presentationMap = ydoc.getMap<Y.Array<Y.Map<unknown>>>('presentation');
  const type = action.type as string;

  let slides = presentationMap.get('slides') as Y.Array<Y.Map<unknown>> | undefined;
  if (!slides) {
    slides = new Y.Array();
    presentationMap.set('slides', slides);
  }

  if (type === 'insert_slide') {
    const newSlide = new Y.Map<unknown>();
    newSlide.set('layout', action.layout as string);
    newSlide.set('elements', new Y.Array());
    const after = action.afterSlide as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    slides.insert(insertIdx, [newSlide]);
    return 1;
  }

  if (type === 'delete_slide') {
    slides.delete(action.slide as number, 1);
    return 1;
  }

  if (type === 'reorder_slides') {
    const order = action.order as number[];
    const snapshots = order.map((i) => slides!.get(i).toJSON());
    // Clear and re-insert in new order
    slides.delete(0, slides.length);
    const reordered = snapshots.map((snap) => {
      const m = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(snap as Record<string, unknown>)) {
        m.set(k, v);
      }
      return m;
    });
    slides.insert(0, reordered);
    return order.length;
  }

  const slideIndex = action.slide as number | undefined;
  if (slideIndex === undefined) return 0;

  const slide = slides.get(slideIndex) as Y.Map<unknown> | undefined;
  if (!slide) throw new Error(`slide_not_found:${slideIndex}`);

  let elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  if (!elements) {
    elements = new Y.Array();
    slide.set('elements', elements);
  }

  if (type === 'insert_element') {
    const elem = action.element as Record<string, unknown>;
    const newEl = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(elem)) {
      newEl.set(k, v);
    }
    elements.push([newEl]);
    return 1;
  }

  if (type === 'update_element') {
    const elId = action.elementId as string;
    const updates = action.updates as Record<string, unknown>;
    const idx = (elements.toArray() as Y.Map<unknown>[]).findIndex((e) => e.get('id') === elId);
    if (idx === -1) throw new Error(`element_not_found:${elId}`);
    const el = elements.get(idx) as Y.Map<unknown>;
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) el.set(k, v);
    }
    return 1;
  }

  if (type === 'delete_element') {
    const elId = action.elementId as string;
    const idx = (elements.toArray() as Y.Map<unknown>[]).findIndex((e) => e.get('id') === elId);
    if (idx === -1) throw new Error(`element_not_found:${elId}`);
    elements.delete(idx, 1);
    return 1;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// applyIntent dispatcher
// ---------------------------------------------------------------------------

function applyIntentAction(ydoc: Y.Doc, intent: DocumentIntent): number {
  const { action } = intent;
  const actionType = action.type;

  // Text intents
  if (
    actionType === 'insert_block' ||
    actionType === 'update_block' ||
    actionType === 'delete_block' ||
    actionType === 'update_marks'
  ) {
    return applyTextIntent(ydoc, action as TextIntentAction);
  }

  // Spreadsheet intents
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

  // Presentation intents
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
  // In-memory idempotency cache (MVP: not storage-backed; survives process lifetime only)
  // Contract note: storage-backed 24-hour cache is a post-MVP requirement
  const cache = new Map<string, CacheEntry>();

  function pruneCache(): void {
    const now = Date.now();
    // Remove expired entries
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    // If still too large, evict oldest by insertion order
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

    // Check idempotency cache
    const cached = cache.get(idempotencyKey);
    if (cached) {
      if (cached.expiresAt > now) {
        return {
          code: 'DUPLICATE_INTENT',
          originalRevisionId: cached.result.revisionId,
        } satisfies DuplicateIntent;
      }
      // Expired — remove and proceed
      cache.delete(idempotencyKey);
    }

    // Get live Yjs document
    const ydoc = deps.getDoc(documentId);
    if (!ydoc) {
      throw new Error('document_not_loaded');
    }

    // OCC: compare baseRevision to current state vector hash
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

    // Apply intent atomically inside a Y.Doc transaction
    let appliedOperations = 0;
    ydoc.transact(() => {
      appliedOperations = applyIntentAction(ydoc, intent);
    });

    // Flush to storage and compute the new revision from the updated state vector
    await deps.flush(documentId, ydoc);
    const newStateVector = Y.encodeStateVector(ydoc);
    const revisionId = computeRevisionId(newStateVector);

    const result: IntentSuccess = { revisionId, appliedOperations };

    // Cache result for idempotency
    pruneCache();
    cache.set(idempotencyKey, { result, expiresAt: now + IDEMPOTENCY_TTL_MS });

    return result;
  }

  return { applyIntent };
}
