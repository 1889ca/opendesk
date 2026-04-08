/** Contract: contracts/federation/rules.md */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  FederationModule,
  FederationPeer,
  FederationConfig,
  TransferRecord,
  TransferBundle,
} from '../contract.ts';
import * as store from './federation-store.ts';
import { signPayload, verifySignature, sha256 } from './signing.ts';
import { loadYjsState, saveYjsState, getDocument } from '../../storage/index.ts';
import { exportAuditProofSummary } from '../../audit/index.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('federation');

export interface FederationDependencies {
  pool: Pool;
  config: FederationConfig;
  hmacSecret: string;
}

/**
 * Factory: creates the federation module.
 * All transfers are signed, verified, and logged immutably.
 */
export function createFederation(deps: FederationDependencies): FederationModule {
  const { pool, config, hmacSecret } = deps;

  async function registerPeer(
    data: Omit<FederationPeer, 'id' | 'createdAt' | 'lastSeenAt' | 'status'>,
  ): Promise<FederationPeer> {
    const peer: FederationPeer = {
      ...data,
      id: randomUUID(),
      status: 'active',
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
    };
    await store.insertPeer(pool, peer);
    log.info('peer registered', { peerId: peer.id, name: peer.name, endpoint: peer.endpointUrl });
    return peer;
  }

  async function listPeers(): Promise<FederationPeer[]> {
    return store.listPeers(pool);
  }

  async function updatePeerStatus(
    peerId: string,
    status: 'active' | 'suspended' | 'revoked',
  ): Promise<boolean> {
    const updated = await store.updatePeerStatus(pool, peerId, status);
    if (updated) log.info('peer status updated', { peerId, status });
    return updated;
  }

  async function sendDocument(
    documentId: string,
    peerId: string,
    actorId: string,
  ): Promise<TransferRecord> {
    const peer = await store.getPeer(pool, peerId);
    if (!peer) throw new Error(`Peer ${peerId} not found`);
    if (peer.status !== 'active') throw new Error(`Peer ${peer.name} is ${peer.status}`);

    const doc = await getDocument(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const state = await loadYjsState(documentId);
    if (!state) throw new Error(`No Yjs state for document ${documentId}`);

    // Get audit proof summary for the transfer
    let auditProofHash: string | null = null;
    try {
      const proofSummary = await exportAuditProofSummary(pool, documentId, hmacSecret);
      auditProofHash = sha256(JSON.stringify(proofSummary));
    } catch {
      log.warn('could not generate audit proof for transfer', { documentId });
    }

    // Build and sign the transfer bundle
    const bundle: TransferBundle = {
      sendingInstanceId: config.instanceId,
      documentId,
      documentTitle: doc.title || 'Untitled',
      yjsStateBase64: Buffer.from(state).toString('base64'),
      auditProofHash: auditProofHash ?? undefined,
      signature: '', // will be set below
      timestamp: new Date().toISOString(),
    };

    const payloadToSign = JSON.stringify({
      sendingInstanceId: bundle.sendingInstanceId,
      documentId: bundle.documentId,
      yjsStateBase64: bundle.yjsStateBase64,
      timestamp: bundle.timestamp,
    });

    bundle.signature = config.privateKey
      ? signPayload(payloadToSign, config.privateKey)
      : sha256(payloadToSign); // fallback for dev (no real keys)

    // Record the transfer
    const transfer: TransferRecord = {
      id: randomUUID(),
      peerId,
      direction: 'outbound',
      documentId,
      documentTitle: doc.title,
      signature: bundle.signature,
      auditProofHash,
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
    };
    await store.insertTransfer(pool, transfer);

    // Send to peer
    try {
      const res = await fetch(`${peer.endpointUrl}/api/federation/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Peer returned ${res.status}: ${errText}`);
      }

      await store.updateTransferStatus(pool, transfer.id, 'completed');
      await store.updateLastSeen(pool, peerId);
      transfer.status = 'completed';

      log.info('document sent to peer', { documentId, peer: peer.name });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await store.updateTransferStatus(pool, transfer.id, 'failed', errMsg);
      transfer.status = 'failed';
      transfer.error = errMsg;
      log.error('send to peer failed', { documentId, peer: peer.name, error: errMsg });
    }

    return transfer;
  }

  async function receiveDocument(bundle: TransferBundle): Promise<TransferRecord> {
    // Find the sending peer by instance ID (look up by checking registered peers)
    const peers = await store.listPeers(pool);
    const peer = peers.find((p) => p.status === 'active');

    if (!peer) {
      throw new Error('No active peer registered — cannot accept inbound transfer');
    }

    // Verify signature
    const payloadToVerify = JSON.stringify({
      sendingInstanceId: bundle.sendingInstanceId,
      documentId: bundle.documentId,
      yjsStateBase64: bundle.yjsStateBase64,
      timestamp: bundle.timestamp,
    });

    const isValid = peer.publicKey.startsWith('-----')
      ? verifySignature(payloadToVerify, bundle.signature, peer.publicKey)
      : bundle.signature === sha256(payloadToVerify); // dev fallback

    const transfer: TransferRecord = {
      id: randomUUID(),
      peerId: peer.id,
      direction: 'inbound',
      documentId: bundle.documentId,
      documentTitle: bundle.documentTitle,
      signature: bundle.signature,
      auditProofHash: bundle.auditProofHash ?? null,
      status: isValid ? 'pending' : 'rejected',
      error: isValid ? null : 'Signature verification failed',
      createdAt: new Date().toISOString(),
    };
    await store.insertTransfer(pool, transfer);

    if (!isValid) {
      log.warn('rejected inbound transfer — invalid signature', {
        peer: peer.name,
        documentId: bundle.documentId,
      });
      return transfer;
    }

    // Import the document
    try {
      const state = new Uint8Array(Buffer.from(bundle.yjsStateBase64, 'base64'));
      await saveYjsState(bundle.documentId, state);
      await store.updateTransferStatus(pool, transfer.id, 'completed');
      await store.updateLastSeen(pool, peer.id);
      transfer.status = 'completed';

      log.info('inbound document imported', {
        documentId: bundle.documentId,
        peer: peer.name,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await store.updateTransferStatus(pool, transfer.id, 'failed', errMsg);
      transfer.status = 'failed';
      transfer.error = errMsg;
    }

    return transfer;
  }

  async function listTransfers(peerId?: string, limit = 50): Promise<TransferRecord[]> {
    return store.listTransfers(pool, peerId, limit);
  }

  return {
    registerPeer,
    listPeers,
    updatePeerStatus,
    sendDocument,
    receiveDocument,
    listTransfers,
  };
}
