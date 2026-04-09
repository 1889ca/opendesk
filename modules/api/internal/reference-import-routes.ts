/** Contract: contracts/api/rules.md */

import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from './async-handler.ts';
import {
  createReference,
  listReferences,
  parseBibTeX,
  serializeBibTeX,
  parseRIS,
  serializeRIS,
  ensureLibraryGrant,
  checkLibraryAccess,
  type ReferenceRow,
  type Reference,
  type Author,
} from '../../references/index.ts';

/** Convert a DB row to the Reference shape expected by serializers. */
function rowToReference(row: ReferenceRow): Reference {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type as Reference['type'],
    title: row.title,
    authors: row.authors as Author[],
    issuedDate: row.issued_date,
    containerTitle: row.container_title,
    volume: row.volume,
    issue: row.issue,
    pages: row.pages,
    doi: row.doi,
    url: row.url,
    isbn: row.isbn,
    abstract: row.abstract,
    publisher: row.publisher,
    language: row.language,
    customFields: row.custom_fields,
    tags: row.tags,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export type ImportExportRoutesOptions = {
  permissions: PermissionsModule;
};

/**
 * Mount reference import/export routes onto a router.
 */
export function createImportExportRoutes(opts: ImportExportRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  // Import references from BibTeX or RIS
  router.post('/import', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const contentType = req.headers['content-type'] ?? '';
    const body = typeof req.body === 'string' ? req.body : String(req.body ?? '');

    if (!body.trim()) {
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    let parsed;
    if (contentType.includes('bibtex') || contentType.includes('x-bibtex')) {
      parsed = parseBibTeX(body);
    } else if (contentType.includes('ris') || contentType.includes('x-ris')) {
      parsed = parseRIS(body);
    } else {
      res.status(415).json({
        error: 'Unsupported format. Use Content-Type: application/x-bibtex or application/x-ris',
      });
      return;
    }

    if (parsed.length === 0) {
      res.status(422).json({ error: 'No valid references found in input' });
      return;
    }

    // Cap the parsed entry count so a 1 MB body of micro-entries
    // can't translate into thousands of INSERTs (review-2026-04-08
    // MED-4). 500 is generous for legitimate library imports.
    if (parsed.length > 500) {
      res.status(413).json({
        error: 'Too many references in one import',
        limit: 500,
        received: parsed.length,
      });
      return;
    }

    const principal = req.principal!;
    const workspaceId = '00000000-0000-0000-0000-000000000000';

    await ensureLibraryGrant(permissions.grantStore, principal.id, workspaceId);
    const canWrite = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'write');
    if (!canWrite) {
      res.status(403).json({ error: 'No write access to reference library' });
      return;
    }

    const created = [];
    for (const input of parsed) {
      const id = randomUUID();
      const row = await createReference(id, workspaceId, principal.id, {
        title: input.title,
        authors: input.authors,
        type: input.type,
        issued_date: input.issuedDate ?? null,
        container_title: input.containerTitle ?? null,
        volume: input.volume ?? null,
        issue: input.issue ?? null,
        pages: input.pages ?? null,
        doi: input.doi ?? null,
        url: input.url ?? null,
        isbn: input.isbn ?? null,
        abstract: input.abstract ?? null,
        publisher: input.publisher ?? null,
        language: input.language ?? 'en',
        custom_fields: input.customFields ?? {},
        tags: input.tags ?? [],
      });
      created.push(row);
    }

    res.status(201).json({ imported: created.length, references: created });
  }));

  // Export references as BibTeX or RIS
  router.get('/export', permissions.requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const format = String(req.query.format ?? '').toLowerCase();
    if (format !== 'bibtex' && format !== 'ris') {
      res.status(400).json({ error: 'Query param "format" must be "bibtex" or "ris"' });
      return;
    }

    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const principal = req.principal!;
    await ensureLibraryGrant(permissions.grantStore, principal.id, workspaceId);
    const canRead = await checkLibraryAccess(permissions.grantStore, principal.id, workspaceId, 'read');
    if (!canRead) {
      res.status(403).json({ error: 'No read access to reference library' });
      return;
    }
    const rows = await listReferences(workspaceId);
    const refs = rows.map(rowToReference);

    if (format === 'bibtex') {
      res.setHeader('Content-Type', 'application/x-bibtex; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="references.bib"');
      res.send(serializeBibTeX(refs));
    } else {
      res.setHeader('Content-Type', 'application/x-ris; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="references.ris"');
      res.send(serializeRIS(refs));
    }
  }));

  return router;
}
