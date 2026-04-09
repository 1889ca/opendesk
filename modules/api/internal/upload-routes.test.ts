/** Contract: contracts/api/rules.md */
import { describe, it, expect } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createUploadRoutes } from './upload-routes.ts';
import { createPermissions, createInMemoryGrantStore } from '../../permissions/index.ts';
import type { Principal } from '../../auth/contract.ts';

function makePrincipal(id: string): Principal {
  return {
    id,
    actorType: 'human',
    displayName: id,
    email: `${id}@opendesk.local`,
    scopes: [],
  };
}

/**
 * Build an Express app mounting the upload routes. The optional
 * `principal` parameter mimics the auth middleware: when omitted,
 * the request is unauthenticated.
 */
function buildApp(principal?: Principal) {
  const grantStore = createInMemoryGrantStore();
  const permissions = createPermissions({ grantStore, authMode: 'oidc' });

  const app = express();

  if (principal) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.principal = principal;
      next();
    });
  }

  app.use('/api', createUploadRoutes({ permissions }));

  return { app, grantStore, permissions };
}

describe('POST /api/upload — issue #130 auth ordering', () => {
  it('rejects unauthenticated requests with 401 before multer parses the body', async () => {
    const { app } = buildApp(/* no principal */);

    // Build a small payload — if multer ran, it would parse this and
    // we'd see different behavior. With requireAuth ahead of multer,
    // we should get 401 immediately and the request body should never
    // be parsed.
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('not-a-real-image'), 'evil.png');

    expect(res.status).toBe(401);
    // Critical: the response shape must match the auth middleware's,
    // not multer's. If multer ran first, we'd see a 400 or a 500.
    expect(res.body).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  });

  it('rejects unauthenticated requests even with no body at all', async () => {
    const { app } = buildApp();

    const res = await request(app).post('/api/upload');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('lets authenticated requests through to multer (which then 400s on missing file)', async () => {
    const alice = makePrincipal('user-alice');
    const { app } = buildApp(alice);

    // No file attached — multer runs (because we are now authenticated)
    // and the handler reaches its `if (!file)` branch.
    const res = await request(app).post('/api/upload');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No file provided' });
  });
});

describe('POST /api/upload — issue #132 MIME magic-byte check', () => {
  // Real PNG signature followed by enough bytes to clear the
  // 12-byte minimum sniff length. No mocks — just a literal magic
  // header.
  const REAL_PNG_HEADER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]);

  // HTML payload that an attacker would try to slip past a route
  // that trusts the multipart Content-Type header.
  const HTML_BOMB = Buffer.from('<html><script>evil</script></html>     ', 'utf8');

  it('rejects HTML uploaded with Content-Type: image/png (the canonical attack)', async () => {
    const alice = makePrincipal('user-alice');
    const { app } = buildApp(alice);

    const res = await request(app)
      .post('/api/upload')
      .attach('file', HTML_BOMB, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'File content does not match claimed type' });
  });

  it('rejects PNG bytes uploaded with Content-Type: image/jpeg', async () => {
    const alice = makePrincipal('user-alice');
    const { app } = buildApp(alice);

    const res = await request(app)
      .post('/api/upload')
      .attach('file', REAL_PNG_HEADER, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('File content does not match claimed type');
  });

  it('lets matching content past the gate (the magic-byte check is positional, not blanket)', async () => {
    // No live S3 here. The point: prove the magic-byte gate PASSES
    // when content matches. The request should reach the S3 path
    // and fail there, NOT be rejected at the gate with 400.
    const alice = makePrincipal('user-alice');
    const { app } = buildApp(alice);

    const res = await request(app)
      .post('/api/upload')
      .attach('file', REAL_PNG_HEADER, {
        filename: 'real.png',
        contentType: 'image/png',
      });

    // If the gate rejected, status would be 400 with our specific
    // error message. Anything else (200 success or 5xx S3 error)
    // means the gate let it through.
    if (res.status === 400) {
      expect(res.body.error).not.toBe('File content does not match claimed type');
    }
  });
});
