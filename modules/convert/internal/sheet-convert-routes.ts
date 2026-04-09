/** Contract: contracts/convert/rules.md */

/**
 * REST surface for spreadsheet import/export.
 * - Import: POST /api/sheets/:id/import — accepts .xlsx, .ods, .csv
 * - Export: POST /api/sheets/:id/export — exports to .xlsx, .ods, .csv
 */

import { Router, raw, type Request, type Response } from 'express';
import {
  importSpreadsheet,
  exportSpreadsheet,
  detectSpreadsheetFormat,
  isValidSpreadsheetExportFormat,
  getSpreadsheetExportMime,
  getSpreadsheetExportExt,
  SpreadsheetImportError,
  SpreadsheetExportError,
  CollaboraError,
} from '../index.ts';
import { getDocument } from '../../storage/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('api:sheet-convert');
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

export type SheetConvertRoutesOptions = {
  permissions: PermissionsModule;
};

export function createSheetConvertRoutes(
  opts: SheetConvertRoutesOptions,
): Router {
  const router = Router();
  const { permissions } = opts;

  router.post(
    '/api/sheets/:id/import',
    permissions.require('write'),
    raw({ type: '*/*', limit: MAX_UPLOAD_SIZE }),
    asyncHandler(handleImport),
  );

  router.post(
    '/api/sheets/:id/export',
    permissions.require('read'),
    asyncHandler(handleExport),
  );

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
  const filename = (Array.isArray(rawFilename)
    ? rawFilename[0]
    : rawFilename) || 'upload.csv';
  const rawMime = req.headers['content-type'];
  const mimeType = Array.isArray(rawMime) ? rawMime[0] : rawMime;
  const format = detectSpreadsheetFormat(mimeType, filename);

  if (!format) {
    res.status(400).json({
      error: 'Unsupported file format. Accepted: .xlsx, .ods, .csv',
    });
    return;
  }

  try {
    const result = await importSpreadsheet(fileBuffer, format, filename);
    res.json({
      ok: true,
      documentId,
      grid: result.grid,
      rowCount: result.rowCount,
      colCount: result.colCount,
    });
  } catch (err) {
    handleConvertError(res, err);
  }
}

async function handleExport(req: Request, res: Response): Promise<void> {
  const documentId = String(req.params.id);
  const { format, grid, title } = (req.body || {}) as {
    format?: string;
    grid?: string[][];
    title?: string;
  };

  if (!format || !isValidSpreadsheetExportFormat(format)) {
    res.status(400).json({
      error: 'format must be "xlsx", "ods", or "csv"',
    });
    return;
  }

  if (!grid || !Array.isArray(grid)) {
    res.status(400).json({ error: 'grid (2D array) is required' });
    return;
  }

  const doc = await getDocument(documentId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  try {
    const result = await exportSpreadsheet(
      grid,
      format,
      title || doc.title || 'spreadsheet',
    );
    const ext = getSpreadsheetExportExt(format);
    const mime = getSpreadsheetExportMime(format);
    const fname = `${title || doc.title || 'spreadsheet'}.${ext}`;

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fname)}"`,
    );
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
  if (err instanceof SpreadsheetImportError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof SpreadsheetExportError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  log.error('unexpected sheet convert error', { error: String(err) });
  res.status(500).json({ error: 'Internal conversion error' });
}
