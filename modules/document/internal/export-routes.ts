/** Contract: contracts/document/rules.md */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDocument } from '../../storage/index.ts';
import { getDocumentForExport } from '../../convert/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';

const ExportBody = z.object({
  format: z.enum(['html', 'text']),
  content: z.string(),
});

const ImportBody = z.object({
  html: z.string().min(1),
});

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
    const bodyResult = ExportBody.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'validation_error', issues: bodyResult.error.issues });
      return;
    }
    const { format, content } = bodyResult.data;
    const meta = await getDocumentForExport(String(req.params.id));
    if (!meta) {
      res.status(404).json({ error: 'Document not found' });
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
    const bodyResult = ImportBody.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({ error: 'validation_error', issues: bodyResult.error.issues });
      return;
    }
    const { html } = bodyResult.data;
    const doc = await getDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ ok: true, html, documentId: req.params.id });
  }));

  return router;
}
