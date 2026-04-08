/** Contract: contracts/federation/rules.md */
import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { Peer } from '../contract.ts';
import { importPublicKey, verifyMessage } from './signing.ts';
import type { SyncMetadataStore } from './sync-metadata.ts';
import { createLogger } from '../../logger/index.ts';

const log = createLogger('federation:sync-in');
const MSG_SYNC = 0;

/**
 * Handle an incoming sync connection from a peer.
 * Verifies the peer's auth message before allowing sync.
 */
export function handleIncomingSyncConnection(
  ws: WebSocket,
  doc: Y.Doc,
  documentId: string,
  peerStore: { findById(id: string): Promise<Peer | null> },
  metadataStore: SyncMetadataStore,
): void {
  let authenticated = false;

  ws.on('message', async (data) => {
    if (!authenticated) {
      authenticated = await handleAuth(ws, data, doc, documentId, peerStore, metadataStore);
      return;
    }
    handleSyncData(data as ArrayBuffer, doc, ws);
  });

  const updateHandler = createUpdateForwarder(ws);
  doc.on('update', updateHandler);
  ws.on('close', () => doc.off('update', updateHandler));
}

async function handleAuth(
  ws: WebSocket,
  data: unknown,
  doc: Y.Doc,
  documentId: string,
  peerStore: { findById(id: string): Promise<Peer | null> },
  metadataStore: SyncMetadataStore,
): Promise<boolean> {
  try {
    const authMsg = JSON.parse((data as Buffer).toString());
    const peer = await peerStore.findById(authMsg.fromInstanceId);
    if (!peer || peer.status !== 'active') {
      ws.close(4001, 'Unknown or inactive peer');
      return false;
    }
    const pubKey = importPublicKey(peer.publicKey);
    if (!verifyMessage(authMsg, pubKey)) {
      ws.close(4002, 'Invalid signature');
      return false;
    }

    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));

    metadataStore.save({
      documentId,
      peerInstanceId: authMsg.fromInstanceId,
      status: 'active',
      openedAt: new Date().toISOString(),
    });

    return true;
  } catch {
    ws.close(4003, 'Auth error');
    return false;
  }
}

function handleSyncData(data: ArrayBuffer, doc: Y.Doc, ws: WebSocket): void {
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
    log.error('incoming sync error', { error: String(err) });
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
