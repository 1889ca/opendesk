/** Contract: contracts/document/rules.md */

/**
 * Document preview route (issue #231).
 * GET /api/documents/:id/preview → { preview: string }
 * Returns the first 200 printable characters extracted from the document's Yjs state.
 */

import { Router, type Request, type Response } from 'express';
import { getDocument, loadYjsState, updateContentPlain } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export type PreviewRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Extract a short plain-text preview from a Yjs binary state buffer.
 * Yjs encodes document content as UTF-8 runs inside a binary envelope;
 * stripping non-printable bytes yields a best-effort readable snippet.
 */
function extractPreview(yjsState: Uint8Array): string {
  const buf = Buffer.from(yjsState);
  const raw = buf.toString('utf8');
  return raw
    .replace(/[^\x20-\x7E\u00A0-\uFFFF\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function createPreviewRoutes(opts: PreviewRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;

  router.get('/:id/preview', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const documentId = String(req.params.id);
    const doc = await getDocument(documentId);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    const yjsState = await loadYjsState(documentId);
    const preview = yjsState ? extractPreview(yjsState) : '';
    if (preview) {
      updateContentPlain(documentId, preview).catch(() => {});
    }
    res.json({ preview });
  }));

  return router;
}
