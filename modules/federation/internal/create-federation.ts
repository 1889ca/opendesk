/** Contract: contracts/federation/rules.md */
import type { KeyObject } from 'node:crypto';
import type { PeerStore } from './peer-registry.ts';
import type { IdentityStore } from './identity-federation.ts';
import type { SyncMetadataStore } from './sync-metadata.ts';
import type { FederatedPermissionStore } from './federated-permissions.ts';
import type { KBFederationStore } from './kb-federation.ts';
import type { SplitBrainStore } from './split-brain.ts';
import type { TokenVerifier } from '../../auth/contract.ts';

/** Dependencies injected into the federation module. */
export interface FederationDependencies {
  localInstanceId: string;
  privateKey: KeyObject;
  tokenVerifier: TokenVerifier;
  peerStore: PeerStore;
  identityStore: IdentityStore;
  syncMetadataStore: SyncMetadataStore;
  permissionStore: FederatedPermissionStore;
  kbStore: KBFederationStore;
  splitBrainStore: SplitBrainStore;
}

/** Assembled federation module with all sub-capabilities. */
export interface FederationModule {
  readonly localInstanceId: string;
  readonly deps: FederationDependencies;
}

/**
 * Create and assemble the federation module from its dependencies.
 * Each sub-capability (peer registry, identity federation, sync, permissions,
 * KB federation, split-brain) is accessed directly via its own exported functions.
 * This factory just validates the configuration and returns a reference holder.
 */
export function createFederation(deps: FederationDependencies): FederationModule {
  if (!deps.localInstanceId) {
    throw new Error('Federation requires a localInstanceId');
  }
  if (!deps.privateKey) {
    throw new Error('Federation requires an Ed25519 private key');
  }

  return {
    localInstanceId: deps.localInstanceId,
    deps,
  };
}
