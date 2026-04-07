/** Contract: contracts/api/rules.md */

import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3, s3Bucket } from './s3-client.ts';
import { asyncHandler } from './async-handler.ts';

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

export function createUploadRoutes(): Router {
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

      const documentId = (req.body?.documentId as string) || 'general';
      if (!/^[0-9a-f-]+$/i.test(documentId) && documentId !== 'general') {
        res.status(400).json({ error: 'Invalid documentId' });
        return;
      }

      const ext = extFromMime(file.mimetype);
      const uuid = randomUUID();
      const key = `uploads/${documentId}/${uuid}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
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
