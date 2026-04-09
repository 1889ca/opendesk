/** Contract: contracts/federation/rules.md */
import { randomUUID, type KeyObject } from 'node:crypto';
import {
  FederatedPermissionSchema,
  type FederatedPermission,
  type FederatedRole,
  type FederatedMessage,
  type Peer,
} from '../contract.ts';
import { signMessage } from './signing.ts';

/** Storage interface for federated permissions. */
export interface FederatedPermissionStore {
  save(permission: FederatedPermission): Promise<void>;
  findById(id: string): Promise<FederatedPermission | null>;
  findByDocument(documentId: string): Promise<FederatedPermission[]>;
  findByPeer(documentId: string, peerInstanceId: string): Promise<FederatedPermission | null>;
  revoke(id: string, revokedAt: string): Promise<void>;
}

export function createInMemoryPermissionStore(): FederatedPermissionStore {
  const permissions = new Map<string, FederatedPermission>();

  return {
    async save(permission) {
      FederatedPermissionSchema.parse(permission);
      permissions.set(permission.id, permission);
    },
    async findById(id) {
      return permissions.get(id) ?? null;
    },
    async findByDocument(documentId) {
      return [...permissions.values()].filter((p) => p.documentId === documentId && !p.revokedAt);
    },
    async findByPeer(documentId, peerInstanceId) {
      return [...permissions.values()].find(
        (p) => p.documentId === documentId && p.peerInstanceId === peerInstanceId && !p.revokedAt,
      ) ?? null;
    },
    async revoke(id, revokedAt) {
      const perm = permissions.get(id);
      if (perm) permissions.set(id, { ...perm, revokedAt });
    },
  };
}

/** Role hierarchy ranks. Federated role must not exceed the granted ceiling. */
const ROLE_RANK: Record<FederatedRole, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
};

/**
 * Grant a federated permission for a document to a peer instance.
 * Enforces that the granted role does not exceed the ceiling role.
 */
export async function grantFederatedPermission(
  store: FederatedPermissionStore,
  documentId: string,
  peerInstanceId: string,
  role: FederatedRole,
  grantedBy: string,
  ceilingRole: FederatedRole,
): Promise<FederatedPermission> {
  if (ROLE_RANK[role] > ROLE_RANK[ceilingRole]) {
    throw new RoleCeilingExceededError(role, ceilingRole);
  }

  const existing = await store.findByPeer(documentId, peerInstanceId);
  if (existing) {
    throw new PermissionAlreadyExistsError(documentId, peerInstanceId);
  }

  const permission: FederatedPermission = {
    id: randomUUID(),
    documentId,
    peerInstanceId,
    role,
    grantedBy,
    grantedAt: new Date().toISOString(),
  };

  await store.save(permission);
  return permission;
}

/**
 * Revoke a federated permission and build a signed revocation message.
 */
export async function revokeFederatedPermission(
  store: FederatedPermissionStore,
  permissionId: string,
  localInstanceId: string,
  privateKey: KeyObject,
): Promise<FederatedMessage | null> {
  const permission = await store.findById(permissionId);
  if (!permission || permission.revokedAt) return null;

  const revokedAt = new Date().toISOString();
  await store.revoke(permissionId, revokedAt);

  const payload = {
    fromInstanceId: localInstanceId,
    toInstanceId: permission.peerInstanceId,
    type: 'permission_revoked',
    payload: { permissionId, documentId: permission.documentId, revokedAt },
    timestamp: revokedAt,
  };
  const signature = signMessage(payload, privateKey);
  return { ...payload, signature };
}

/**
 * Check if a federated peer has a given role or higher on a document.
 */
export async function checkFederatedPermission(
  store: FederatedPermissionStore,
  documentId: string,
  peerInstanceId: string,
  requiredRole: FederatedRole,
): Promise<boolean> {
  const perm = await store.findByPeer(documentId, peerInstanceId);
  if (!perm) return false;
  return ROLE_RANK[perm.role] >= ROLE_RANK[requiredRole];
}

export class RoleCeilingExceededError extends Error {
  constructor(requested: FederatedRole, ceiling: FederatedRole) {
    super(`Requested role '${requested}' exceeds ceiling '${ceiling}'`);
    this.name = 'RoleCeilingExceededError';
  }
}

export class PermissionAlreadyExistsError extends Error {
  constructor(documentId: string, peerInstanceId: string) {
    super(`Permission already exists for ${documentId} on peer ${peerInstanceId}`);
    this.name = 'PermissionAlreadyExistsError';
  }
}
