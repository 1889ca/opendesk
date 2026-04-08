/** Contract: contracts/api/rules.md */

/**
 * API routes for document import/export via Collabora.
 * Mounted at /api/documents/:id/convert-*.
 */

import { Router, raw, type Request, type Response } from 'express';
import {
  convertViaCollabora,
  importViaCollabora,
  detectImportFormat,
  isValidExportFormat,
  getExportMimeType,
  getExportExtension,
  CollaboraError,
  ImportError,
} from '../../convert/index.ts';
import { getDocument } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('api:convert');
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

export type ConvertRoutesOptions = {
  permissions: PermissionsModule;
};

export function createConvertRoutes(opts: ConvertRoutesOptions): Router {
  const router = Router();
  const { permissions } = opts;

  router.post(
    '/api/documents/:id/convert-import',
    permissions.require('write'),
    raw({ type: '*/*', limit: MAX_UPLOAD_SIZE }),
    asyncHandler(handleImport)
  );

  router.post('/api/documents/:id/convert-export', permissions.require('read'), asyncHandler(handleExport));

  return router;
}

async function handleImport(req: Request, res: Response): Promise<void> {
  const documentId = String(req.params.id);
  const doc = await getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
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
  const filename = (Array.isArray(rawFilename) ? rawFilename[0] : rawFilename) || 'upload.docx';
  const rawMime = req.headers['content-type'];
  const mimeType = Array.isArray(rawMime) ? rawMime[0] : rawMime;
  const format = detectImportFormat(mimeType, filename);

  if (!format) {
    res.status(400).json({
      error: 'Unsupported file format. Accepted: .docx, .odt, .pdf',
    });
    return;
  }

  try {
    const result = await importViaCollabora(
      fileBuffer, format, documentId, filename
    );
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
  const { format, content, requestedBy } = (req.body || {}) as Record<string, string>;

  if (!format || !isValidExportFormat(format)) {
    res.status(400).json({
      error: 'format must be "docx", "odt", or "pdf"',
    });
    return;
  }

  if (!content && content !== '') {
    res.status(400).json({ error: 'content (HTML) is required' });
    return;
  }

  const doc = await getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  try {
    const result = await convertViaCollabora(
      content, format, documentId, requestedBy || 'anonymous'
    );
    const title = doc.title || 'document';
    const ext = getExportExtension(format);
    const mime = getExportMimeType(format);
    const fname = `${title}.${ext}`;

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fname)}"`
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
  if (err instanceof ImportError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  log.error('unexpected error', { error: String(err) });
  res.status(500).json({ error: 'Internal conversion error' });
}
