/** Contract: contracts/federation/rules.md */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { FederationModule } from '../contract.ts';
import { TransferBundleSchema } from '../contract.ts';
import type { PermissionsModule } from '../../permissions/index.ts';
import { asyncHandler } from '../../api/internal/async-handler.ts';
import { verifySignature, sha256 } from './signing.ts';

const RegisterPeerBody = z.object({
  name: z.string().min(1).max(200),
  endpointUrl: z.string().url(),
  publicKey: z.string().min(1),
  trustLevel: z.enum(['standard', 'elevated', 'restricted']).default('standard'),
});

const SendDocumentBody = z.object({
  documentId: z.string().uuid(),
  peerId: z.string().uuid(),
});

const UpdatePeerStatusBody = z.object({
  status: z.enum(['active', 'suspended', 'revoked']),
});

export interface FederationRoutesOptions {
  federation: FederationModule;
  permissions: PermissionsModule;
}

/**
 * Mount federation routes under /api/federation.
 */
export function createFederationRoutes(opts: FederationRoutesOptions): Router {
  const { federation, permissions } = opts;
  const router = Router();

  // POST /api/federation/peers — register a new peer (admin only)
  router.post(
    '/peers',
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = RegisterPeerBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const peer = await federation.registerPeer({
        ...parsed.data,
        registeredBy: principal.id,
      });
      res.status(201).json(peer);
    }),
  );

  // GET /api/federation/peers — list all peers
  router.get(
    '/peers',
    permissions.requireAuth,
    asyncHandler(async (_req: Request, res: Response) => {
      const peers = await federation.listPeers();
      res.json(peers);
    }),
  );

  // PATCH /api/federation/peers/:id — update peer status (admin only)
  router.patch(
    '/peers/:id',
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = UpdatePeerStatusBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const ok = await federation.updatePeerStatus(String(req.params.id), parsed.data.status);
      if (!ok) {
        res.status(404).json({ error: 'Peer not found' });
        return;
      }
      res.json({ ok: true });
    }),
  );

  // POST /api/federation/send — send a document to a peer (admin only)
  router.post(
    '/send',
    permissions.requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = SendDocumentBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
        return;
      }

      const principal = req.principal!;
      const allowed = await permissions.checkPermission(
        principal.id,
        parsed.data.documentId,
        'manage',
      );
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const transfer = await federation.sendDocument(
        parsed.data.documentId,
        parsed.data.peerId,
        principal.id,
      );
      res.json(transfer);
    }),
  );

  // POST /api/federation/receive — receive an inbound transfer (called by peers)
  // Authenticates via peer signature verification (no user auth — peers are the callers)
  router.post(
    '/receive',
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = TransferBundleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid transfer bundle', issues: parsed.error.issues });
        return;
      }

      const bundle = parsed.data;

      // 1. Require a signature in the bundle
      if (!bundle.signature) {
        res.status(401).json({ error: 'Missing transfer signature' });
        return;
      }

      // 2. Look up the sending peer and verify it is registered + active
      const peers = await federation.listPeers();
      const peer = peers.find(
        (p) => p.status === 'active' && p.name === bundle.sendingInstanceId,
      );
      if (!peer) {
        res.status(403).json({ error: 'Unknown or inactive sending peer' });
        return;
      }

      // 3. Verify signature against the peer's public key
      const payloadToVerify = JSON.stringify({
        sendingInstanceId: bundle.sendingInstanceId,
        documentId: bundle.documentId,
        yjsStateBase64: bundle.yjsStateBase64,
        timestamp: bundle.timestamp,
      });

      const isValid = peer.publicKey.startsWith('-----')
        ? verifySignature(payloadToVerify, bundle.signature, peer.publicKey)
        : bundle.signature === sha256(payloadToVerify); // dev fallback

      if (!isValid) {
        res.status(403).json({ error: 'Invalid peer signature' });
        return;
      }

      const transfer = await federation.receiveDocument(bundle);

      if (transfer.status === 'rejected') {
        res.status(403).json({ error: 'Transfer rejected', reason: transfer.error });
        return;
      }

      res.json(transfer);
    }),
  );

  // GET /api/federation/transfers — list transfer history
  router.get(
    '/transfers',
    permissions.requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const peerId = req.query.peerId as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const transfers = await federation.listTransfers(peerId, limit);
      res.json(transfers);
    }),
  );

  return router;
}
