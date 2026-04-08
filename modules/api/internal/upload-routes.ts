/** Contract: contracts/api/rules.md */

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3, getS3Bucket } from './s3-client.ts';
import { asyncHandler } from './async-handler.ts';
import { createLogger } from '../../logger/index.ts';
import type { PermissionsModule } from '../../permissions/index.ts';

const log = createLogger('api:upload');

const UploadBody = z.object({
  documentId: z.string().regex(/^[0-9a-f-]+$/i).optional().default('general'),
});

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mime] || 'bin';
}

export type UploadRoutesOptions = {
  permissions: PermissionsModule;
};

export function createUploadRoutes(opts: UploadRoutesOptions): Router {
  const { permissions } = opts;
  const router = Router();

  router.post(
    '/upload',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const bodyResult = UploadBody.safeParse(req.body ?? {});
      if (!bodyResult.success) {
        res.status(400).json({ error: 'Validation failed', issues: bodyResult.error.issues });
        return;
      }
      const { documentId } = bodyResult.data;

      const principal = req.principal;
      if (!principal) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (documentId === 'general') {
        // General bucket: authenticated users may upload, but log for audit trail
        log.info('general-bucket upload', {
          userId: principal.id,
          mimetype: file.mimetype,
          size: file.size,
        });
      } else {
        // Document-specific bucket: enforce write permission
        const allowed = await permissions.checkPermission(principal.id, documentId, 'write');
        if (!allowed) {
          res.status(403).json({ error: 'You do not have write access to this document' });
          return;
        }
      }

      const ext = extFromMime(file.mimetype);
      const uuid = randomUUID();
      const key = `uploads/${documentId}/${uuid}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: getS3Bucket(),
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      res.json({
        url: `/api/files/${key}`,
        key,
        contentType: file.mimetype,
        size: file.size,
      });
    }),
  );

  return router;
}
