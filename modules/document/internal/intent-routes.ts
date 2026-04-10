/** Contract: contracts/api/rules.md */
import { Router, type Request, type Response } from 'express';
import type { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';
import type { PermissionsModule } from '../../permissions/index.ts';
import { createDocumentRepository } from '../../storage/index.ts';
import type { ColdStorageAdapter } from '../../storage/internal/cold-storage.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { createIntentExecutor } from '../../collab/internal/intent-executor.ts';
import { createDocumentMaterializer, computeRevisionId } from '../../collab/internal/document-materializer.ts';
import { DocumentIntentSchema } from '../contract/index.ts';

// ---------------------------------------------------------------------------
// Body schema — DocumentIntent fields submitted over HTTP.
// documentId is taken from the URL param and merged before full validation.
// ---------------------------------------------------------------------------

const IntentBodySchema = DocumentIntentSchema.omit({ documentId: true });

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export interface IntentRoutesOptions {
  permissions: PermissionsModule;
  hocuspocus: Hocuspocus;
  /** Optional cold storage adapter; enables transparent hot/cold tiering in getSnapshot. */
  coldAdapter?: ColdStorageAdapter;
}

/**
 * Mounts POST / on a router scoped to /api/documents/:id/intents.
 * The manifest mounts this with mergeParams enabled via the Express route path.
 *
 * Responds:
 *   200 { revisionId, appliedOperations } — intent applied successfully
 *   409 { code, baseRevision, currentRevision } — stale base revision (OCC conflict)
 *   208 { code, originalRevisionId } — duplicate idempotency key (already applied)
 *   503 { code } — document not loaded in memory (retry after opening the document)
 */
export function createIntentRoutes(opts: IntentRoutesOptions): Router {
  const { permissions, hocuspocus, coldAdapter } = opts;

  // DocumentRepository is stateless — create once per route factory invocation.
  // Passing the cold adapter enables transparent hot/cold tiering in getSnapshot.
  const repo = createDocumentRepository(coldAdapter);
  const materializer = createDocumentMaterializer({ repo });

  const executor = createIntentExecutor({
    getDoc(docId: string): Y.Doc | null {
      const doc = hocuspocus.documents.get(docId);
      return doc ? (doc as unknown as Y.Doc) : null;
    },

    async flush(docId: string, ydoc: Y.Doc): Promise<void> {
      await materializer.flush(docId, ydoc);
    },

    getCurrentRevisionId(docId: string): string | null {
      const doc = hocuspocus.documents.get(docId);
      if (!doc) return null;
      const stateVector = Y.encodeStateVector(doc as unknown as Y.Doc);
      return computeRevisionId(stateVector);
    },
  });

  const router = Router({ mergeParams: true });

  router.post(
    '/',
    permissions.require('write'),
    asyncHandler(async (req: Request, res: Response) => {
      const docId = String(req.params.id);

      // Parse body (without documentId — that comes from the URL)
      const bodyResult = IntentBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: bodyResult.error.issues,
        });
        return;
      }

      // Assemble and re-validate the full DocumentIntent
      const fullResult = DocumentIntentSchema.safeParse({
        ...bodyResult.data,
        documentId: docId,
      });
      if (!fullResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: fullResult.error.issues,
        });
        return;
      }

      let result;
      try {
        result = await executor.applyIntent(fullResult.data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'document_not_loaded') {
          res.status(503).json({
            code: 'DOCUMENT_NOT_LOADED',
            message:
              'Document is not currently loaded in memory. Open the document first, then retry.',
          });
          return;
        }
        throw err;
      }

      if ('code' in result) {
        if (result.code === 'STALE_REVISION') {
          res.status(409).json({
            code: result.code,
            baseRevision: result.baseRevision,
            currentRevision: result.currentRevision,
          });
          return;
        }
        if (result.code === 'DUPLICATE_INTENT') {
          // 208 Already Reported — idempotent replay, safe to retry
          res.status(208).json({
            code: result.code,
            originalRevisionId: result.originalRevisionId,
          });
          return;
        }
      }

      // IntentSuccess
      const success = result as { revisionId: string; appliedOperations: number };
      res.status(200).json({
        revisionId: success.revisionId,
        appliedOperations: success.appliedOperations,
      });
    }),
  );

  return router;
}
