/** Contract: contracts/document/rules.md */

import { Router, type Request, type Response } from 'express';
import { getDocument } from '../../storage/index.ts';
import { getDocumentForExport } from '../../convert/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

export type ExportRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount export/import routes onto a router.
 * Each route enforces authentication and permission checks.
 */
export function createExportRoutes(opts: ExportRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;

  // Export document — requires read permission
  router.post('/:id/export', permissions.require('read'), asyncHandler(async (req: Request, res: Response) => {
    const format = req.body?.format;
    if (!format || !['html', 'text'].includes(format)) {
      res.status(400).json({ error: 'format must be "html" or "text"' });
      return;
    }
    const meta = await getDocumentForExport(String(req.params.id));
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    const content = req.body?.content;
    if (!content && content !== '') {
      res.status(400).json({ error: 'content is required (client-side export)' });
      return;
    }
    const ext = format === 'html' ? 'html' : 'txt';
    const filename = `${meta.title || 'document'}.${ext}`;
    const contentType = format === 'html'
      ? 'text/html; charset=utf-8'
      : 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    const output = format === 'text'
      ? String(content).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      : content;
    res.send(output);
  }));

  // Import HTML into document — requires write permission
  router.post('/:id/import', permissions.require('write'), asyncHandler(async (req: Request, res: Response) => {
    const html = req.body?.html;
    if (!html) {
      res.status(400).json({ error: 'html content is required' });
      return;
    }
    const doc = await getDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true, html, documentId: req.params.id });
  }));

  return router;
}
