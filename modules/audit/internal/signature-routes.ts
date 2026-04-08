/** Contract: contracts/audit/yjs-signatures.md */

import { Router, type Request, type Response } from 'express';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/index.ts';
import { verifyDocumentSignatures } from './yjs-signatures.ts';
import {
  generateSigningKeyPair,
  storePublicKey,
  loadPublicKey,
} from './ed25519-keys.ts';
import type { Pool } from 'pg';

export type SignatureRoutesOptions = {
  permissions: PermissionsModule;
  pool: Pool;
};

/**
 * Routes for Yjs update signature management and verification.
 */
export function createSignatureRoutes(opts: SignatureRoutesOptions): Router {
  const router = Router();
  const { permissions, pool } = opts;

  // POST /keys — generate and register a signing key pair for the current user
  router.post(
    '/keys',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const actorId = req.principal!.id;
      const { publicKey, privateKey } = generateSigningKeyPair();

      await storePublicKey(pool, actorId, publicKey);

      // Return the private key PEM exactly once — client must store it securely
      const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      res.status(201).json({
        actorId,
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
      });
    }),
  );

  // GET /keys/:actorId — retrieve a user's public key
  router.get(
    '/keys/:actorId',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const actorId = String(req.params.actorId);
      const publicKey = await loadPublicKey(pool, actorId);
      if (!publicKey) {
        res.status(404).json({ error: 'No signing key found for this user' });
        return;
      }
      const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      res.json({ actorId, publicKey: pem });
    }),
  );

  // GET /signatures/verify/:documentId — verify all Yjs update signatures
  router.get(
    '/signatures/verify/:documentId',
    permissions.requireForResource('manage', 'document'),
    asyncHandler(async (req: Request, res: Response) => {
      const documentId = String(req.params.documentId);

      const principal = (req as any).principal;
      const allowed = await permissions.checkPermission(
        principal.id,
        documentId,
        'manage',
      );
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const result = await verifyDocumentSignatures(pool, documentId);
      res.json(result);
    }),
  );

  return router;
}
