/** Contract: contracts/federation/rules.md */
import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { Peer } from '../contract.ts';
import type { KeyObject } from 'node:crypto';
import { signMessage } from './signing.ts';
import { validatePeerUrl } from './peer-url-validator.ts';
import type { SyncMetadataStore } from './sync-metadata.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('federation:sync-out');
const MSG_SYNC = 0;

export interface SyncChannelOptions {
  /** Permit RFC1918 / ULA peer addresses (self-hosted LAN). */
  allowPrivateNetworks?: boolean;
  /** Permit ws:// (and http://) peers in addition to wss:// (and https://). */
  allowInsecureSchemes?: boolean;
}

/**
 * Open a bidirectional Yjs sync channel to a peer instance.
 *
 * Re-validates the peer URL via {@link validatePeerUrl} before
 * dialing — this is defense-in-depth on top of the registration-time
 * check (issue #131), in case DNS resolution has changed since the
 * peer was first registered.
 *
 * Returns a promise rather than a synchronous handle because URL
 * validation requires DNS resolution.
 */
export async function openSyncChannel(
  doc: Y.Doc,
  peer: Peer,
  documentId: string,
  localInstanceId: string,
  privateKey: KeyObject,
  metadataStore: SyncMetadataStore,
  opts: SyncChannelOptions = {},
): Promise<{ ws: WebSocket; close: () => void }> {
  const syncUrl = `${peer.endpoint.replace(/^http/, 'ws')}/federation/sync/${documentId}`;

  // Issue #131: validate the resolved address before opening a socket.
  // Throws PeerUrlValidationError if the peer URL has been pointed at
  // internal infrastructure since registration.
  await validatePeerUrl(syncUrl, {
    allowPrivateNetworks: opts.allowPrivateNetworks,
    allowInsecureSchemes: opts.allowInsecureSchemes,
  });

  const ws = new WebSocket(syncUrl);
  ws.binaryType = 'arraybuffer';

  ws.on('open', () => {
    log.info('sync channel opened', { documentId, peer: peer.instanceId });
    sendAuthHandshake(ws, localInstanceId, peer.instanceId, documentId, privateKey);
    sendSyncStep1(ws, doc);
    metadataStore.save({
      documentId,
      peerInstanceId: peer.instanceId,
      status: 'active',
      openedAt: new Date().toISOString(),
    });
  });

  ws.on('message', (data) => {
    handleSyncMessage(data as ArrayBuffer, doc, ws);
    metadataStore.updateLastSync(documentId, peer.instanceId);
  });

  ws.on('close', () => {
    log.info('sync channel closed', { documentId, peer: peer.instanceId });
    metadataStore.updateStatus(documentId, peer.instanceId, 'closed');
  });

  ws.on('error', (err) => {
    log.error('sync channel error', { documentId, error: String(err) });
    metadataStore.updateStatus(documentId, peer.instanceId, 'paused');
  });

  const updateHandler = createUpdateForwarder(ws);
  doc.on('update', updateHandler);

  return {
    ws,
    close() {
      doc.off('update', updateHandler);
      ws.close();
    },
  };
}

function sendAuthHandshake(
  ws: WebSocket,
  localInstanceId: string,
  peerInstanceId: string,
  documentId: string,
  privateKey: KeyObject,
): void {
  const authPayload = {
    fromInstanceId: localInstanceId,
    toInstanceId: peerInstanceId,
    type: 'sync_auth',
    payload: { documentId },
    timestamp: new Date().toISOString(),
  };
  const signature = signMessage(authPayload, privateKey);
  ws.send(JSON.stringify({ ...authPayload, signature }));
}

function sendSyncStep1(ws: WebSocket, doc: Y.Doc): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
}

function handleSyncMessage(data: ArrayBuffer, doc: Y.Doc, ws: WebSocket): void {
  try {
    const buf = new Uint8Array(data);
    const decoder = decoding.createDecoder(buf);
    const msgType = decoding.readVarUint(decoder);
    if (msgType === MSG_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, null);
      if (encoding.length(encoder) > 1) {
        ws.send(encoding.toUint8Array(encoder));
      }
    }
  } catch (err) {
    log.error('sync message error', { error: String(err) });
  }
}

function createUpdateForwarder(ws: WebSocket): (update: Uint8Array, origin: unknown) => void {
  return (update, origin) => {
    if (origin === ws || ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  };
}
