/** Contract: contracts/convert/rules.md */

/**
 * REST surface for presentation import/export via Collabora.
 * Mounted at /api/presentations/:id/convert-*.
 */

import { Router, raw, type Request, type Response } from 'express';
import {
  importSlideFile,
  exportPresentation,
  detectImportFormat,
  isPresentationFormat,
  isValidExportFormat,
  getExportMimeType,
  getExportExtension,
  CollaboraError,
  SlideImportError,
} from '../index.ts';
import type { PresentationContent } from '../../document/contract/index.ts';
import { getDocument } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('api:presentation-convert');
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB for presentations

export type PresentationConvertRoutesOptions = {
  permissions: PermissionsModule;
};

export function createPresentationConvertRoutes(
  opts: PresentationConvertRoutesOptions,
): Router {
  const router = Router();
  const { permissions } = opts;

  router.post(
    '/api/presentations/:id/convert-import',
    permissions.require('write'),
    raw({ type: '*/*', limit: MAX_UPLOAD_SIZE }),
    asyncHandler(handleImport),
  );

  router.post(
    '/api/presentations/:id/convert-export',
    permissions.require('read'),
    asyncHandler(handleExport),
  );

  return router;
}

async function handleImport(req: Request, res: Response): Promise<void> {
  const documentId = String(req.params.id);
  const doc = await getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Presentation not found' });
    return;
  }

  const fileBuffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body as ArrayBuffer);

  if (fileBuffer.length === 0) {
    res.status(400).json({ error: 'No file content received' });
    return;
  }

  const rawFilename = req.headers['x-filename'];
  const filename = (Array.isArray(rawFilename) ? rawFilename[0] : rawFilename) || 'upload.pptx';
  const rawMime = req.headers['content-type'];
  const mimeType = Array.isArray(rawMime) ? rawMime[0] : rawMime;
  const format = detectImportFormat(mimeType, filename);

  if (!format || !isPresentationFormat(format)) {
    res.status(400).json({
      error: 'Unsupported file format. Accepted: .pptx, .odp',
    });
    return;
  }

  try {
    const result = await importSlideFile(fileBuffer, format, documentId, filename);
    res.json({
      ok: true,
      documentId: result.documentId,
      snapshot: result.snapshot,
    });
  } catch (err) {
    handleConvertError(res, err);
  }
}

async function handleExport(req: Request, res: Response): Promise<void> {
  const documentId = String(req.params.id);
  const { format, content } = (req.body || {}) as {
    format?: string;
    content?: PresentationContent;
  };

  const validFormats = ['pdf', 'pptx', 'odp'];
  if (!format || !validFormats.includes(format) || !isValidExportFormat(format)) {
    res.status(400).json({
      error: 'format must be "pdf", "pptx", or "odp"',
    });
    return;
  }

  if (!content || !content.slides) {
    res.status(400).json({ error: 'content with slides array is required' });
    return;
  }

  const doc = await getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Presentation not found' });
    return;
  }

  try {
    const result = await exportPresentation(documentId, format, content);
    const title = doc.title || 'presentation';
    const ext = getExportExtension(format);
    const mime = getExportMimeType(format);
    const fname = `${title}.${ext}`;

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fname)}"`,
    );
    res.setHeader('X-Export-Stale', String(result.stale));
    res.setHeader('X-Export-At', result.exportedAt);
    res.send(result.fileBuffer);
  } catch (err) {
    handleConvertError(res, err);
  }
}

function handleConvertError(res: Response, err: unknown): void {
  if (err instanceof CollaboraError) {
    res.status(502).json({
      error: 'Conversion service unavailable',
      detail: err.message,
    });
    return;
  }
  if (err instanceof SlideImportError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  log.error('unexpected error', { error: String(err) });
  res.status(500).json({ error: 'Internal conversion error' });
}
