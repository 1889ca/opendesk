/** Contract: contracts/federation/rules.md */
import type { Pool } from 'pg';
import type {
  FederationModule,
  FederationPeer,
  FederationConfig,
  TransferBundle,
} from '../contract.ts';
import { randomUUID } from 'node:crypto';
import * as store from './federation-store.ts';
import * as transferOps from './transfer-ops.ts';
import { validatePeerUrl } from './peer-url-validator.ts';
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
    // Issue #131: validate the peer URL is not pointed at internal
    // infrastructure before persisting it. The same check runs again
    // at sync-channel open time as defense in depth (DNS can change).
    await validatePeerUrl(data.endpointUrl, {
      allowPrivateNetworks: config.allowPrivateNetworks,
      allowInsecureSchemes: config.allowInsecureSchemes,
    });

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

  async function sendDocument(documentId: string, peerId: string, actorId: string) {
    return transferOps.sendDocument(pool, config, hmacSecret, documentId, peerId, actorId);
  }

  async function receiveDocument(bundle: TransferBundle) {
    return transferOps.receiveDocument(pool, bundle);
  }

  async function listTransfers(peerId?: string, limit = 50) {
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
