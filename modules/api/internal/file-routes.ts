/** Contract: contracts/api/rules.md */

import { Router } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3, s3Bucket } from './s3-client.ts';
import { asyncHandler } from './async-handler.ts';
import type { Readable } from 'node:stream';
import type { PermissionsModule } from '../../permissions/index.ts';

export type FileRoutesOptions = {
  permissions: PermissionsModule;
};

/** Extract the documentId segment from a file key like "uploads/{docId}/{uuid}.ext" */
function extractDocumentId(key: string): string | null {
  const parts = key.split('/');
  return parts.length >= 3 ? parts[1] : null;
}

export function createFileRoutes(opts: FileRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  router.get(
    '/files/*key',
    asyncHandler(async (req, res) => {
      const raw = req.params.key;
      const key = Array.isArray(raw) ? raw.join('/') : raw;
      if (!key) {
        res.status(400).json({ error: 'Missing file key' });
        return;
      }

      if (!key.startsWith('uploads/') || key.includes('..')) {
        res.status(403).json({ error: 'Forbidden file path' });
        return;
      }

      // Enforce read permission when serving document-specific files
      const documentId = extractDocumentId(key);
      if (documentId && documentId !== 'general') {
        const principal = req.principal;
        if (!principal) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        const allowed = await permissions.checkPermission(principal.id, documentId, 'read');
        if (!allowed) {
          res.status(403).json({ error: 'You do not have read access to this document' });
          return;
        }
      }

      try {
        const response = await s3.send(
          new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
        );

        if (response.ContentType) {
          res.setHeader('Content-Type', response.ContentType);
        }
        if (response.ContentLength != null) {
          res.setHeader('Content-Length', String(response.ContentLength));
        }

        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const contentType = response.ContentType || '';
        const disposition = contentType.startsWith('image/')
          ? 'inline'
          : 'attachment';
        res.setHeader('Content-Disposition', disposition);

        // Cache immutable uploads for 1 year (content-addressed by UUID)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const body = response.Body as Readable | undefined;
        if (!body) {
          res.status(404).json({ error: 'Empty response body' });
          return;
        }
        body.on('error', (err) => {
          console.error('[opendesk] stream error:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });
        body.pipe(res);
      } catch (err: unknown) {
        const code = (err as { name?: string }).name;
        if (code === 'NoSuchKey') {
          res.status(404).json({ error: 'File not found' });
          return;
        }
        throw err;
      }
    }),
  );

  return router;
}
