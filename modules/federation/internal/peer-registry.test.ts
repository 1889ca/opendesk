/** Contract: contracts/federation/rules.md */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPeer,
  verifyPeerMessage,
  createInMemoryPeerStore,
  PeerAlreadyExistsError,
  type PeerStore,
} from './peer-registry.ts';
import { generateKeyPair, exportPublicKey, signMessage } from './signing.ts';
import type { FederatedMessage } from '../contract.ts';

describe('peer-registry', () => {
  let store: PeerStore;
  const { publicKey, privateKey } = generateKeyPair();
  const pubKeyBase64 = exportPublicKey(publicKey);

  beforeEach(() => {
    store = createInMemoryPeerStore();
  });

  it('registers a new peer', async () => {
    const peer = await registerPeer(store, {
      instanceId: 'peer-1',
      name: 'Test Peer',
      endpoint: 'https://peer-1.example.com',
      publicKey: pubKeyBase64,
    });

    expect(peer.instanceId).toBe('peer-1');
    expect(peer.status).toBe('active');
    expect(peer.registeredAt).toBeTruthy();
  });

  it('rejects duplicate peer registration', async () => {
    await registerPeer(store, {
      instanceId: 'peer-1',
      name: 'Test Peer',
      endpoint: 'https://peer-1.example.com',
      publicKey: pubKeyBase64,
    });

    await expect(
      registerPeer(store, {
        instanceId: 'peer-1',
        name: 'Duplicate',
        endpoint: 'https://peer-1.example.com',
        publicKey: pubKeyBase64,
      }),
    ).rejects.toThrow(PeerAlreadyExistsError);
  });

  it('verifies a signed message from a registered peer', async () => {
    await registerPeer(store, {
      instanceId: 'peer-1',
      name: 'Test Peer',
      endpoint: 'https://peer-1.example.com',
      publicKey: pubKeyBase64,
    });

    const payload = {
      fromInstanceId: 'peer-1',
      toInstanceId: 'local',
      type: 'test',
      payload: {},
      timestamp: new Date().toISOString(),
    };
    const signature = signMessage(payload, privateKey);
    const message: FederatedMessage = { ...payload, signature };

    expect(await verifyPeerMessage(store, message)).toBe(true);
  });

  it('rejects message from unknown peer', async () => {
    const payload = {
      fromInstanceId: 'unknown',
      toInstanceId: 'local',
      type: 'test',
      payload: {},
      timestamp: new Date().toISOString(),
    };
    const signature = signMessage(payload, privateKey);
    const message: FederatedMessage = { ...payload, signature };

    expect(await verifyPeerMessage(store, message)).toBe(false);
  });

  it('rejects message from suspended peer', async () => {
    await registerPeer(store, {
      instanceId: 'peer-1',
      name: 'Test Peer',
      endpoint: 'https://peer-1.example.com',
      publicKey: pubKeyBase64,
    });
    await store.updateStatus('peer-1', 'suspended');

    const payload = {
      fromInstanceId: 'peer-1',
      toInstanceId: 'local',
      type: 'test',
      payload: {},
      timestamp: new Date().toISOString(),
    };
    const signature = signMessage(payload, privateKey);
    const message: FederatedMessage = { ...payload, signature };

    expect(await verifyPeerMessage(store, message)).toBe(false);
  });
});
