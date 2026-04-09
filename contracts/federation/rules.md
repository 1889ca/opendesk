# Contract: federation

## Purpose

Cross-sovereign federation enabling document exchange between distinct OpenDesk instances. Uses verifiable, non-repudiable document transfers — each transfer is cryptographically signed, auditable, and permission-checked on both sides.

## Inputs

- `FederationPeer`: A registered remote OpenDesk instance (URL, public key, trust level).
- `OutboundTransfer`: Document snapshot + audit proof bundle sent to a peer.
- `InboundTransfer`: Received document snapshot from a trusted peer, verified by signature.

## Outputs

- `FederationPeer`: Registered peer with status and last-seen timestamp.
- `TransferRecord`: Immutable log of every document exchange (inbound/outbound).
- `TransferVerification`: Result of signature/integrity check on received documents.

## Side Effects

- Stores peer registrations in `federation_peers` table.
- Stores transfer records in `federation_transfers` table.
- Creates new documents from inbound transfers (imported as fresh Yjs state).
- Emits domain events for federation activity.

## Invariants

- Every transfer is signed with the sending instance's private key.
- Inbound documents are verified against the peer's registered public key before import.
- Transfer records are append-only (never modified or deleted).
- Federation is opt-in per instance (disabled by default).
- No real-time CRDT sync across instances (snapshot-based exchange only).
- Each transfer includes the document's audit proof for compliance verification.

## Dependencies

- `config` — Federation configuration (instance ID, key pair, enabled flag).
- `storage` — Document creation and Yjs state persistence.
- `audit` — Proof export for transfer bundles.
- `logger` — Structured logging.

## Boundary Rules

- MUST: Verify peer signatures on all inbound transfers.
- MUST: Include audit proof with every outbound transfer.
- MUST: Log every transfer (inbound and outbound) immutably.
- MUST: Require explicit peer registration before accepting transfers.
- MUST NOT: Auto-accept transfers from unregistered peers.
- MUST NOT: Modify transferred document content during import.
- MUST NOT: Expose federation endpoints when federation is disabled.

## Verification

- Peer registration: Register peer, verify stored correctly with public key.
- Outbound transfer: Export document to peer, verify signed bundle includes audit proof.
- Inbound verification: Receive signed bundle, verify signature matches registered peer.
- Tampered transfer: Modify signed bundle, verify import is rejected.
- Disabled federation: Verify endpoints return 404 when federation disabled.
Enable sovereign OpenDesk instances to federate: share documents, sync CRDT state, map identities across OIDC/SAML boundaries, propagate permissions, federate KB libraries, and resolve split-brain conflicts after network partitions.
- `PeerRegistration`: `{ instanceId, endpoint, publicKey, name }` -- register a federated peer instance
- `FederatedIdentity`: `{ localUserId, remoteInstanceId, remoteUserId }` -- map remote user to local
- `SyncChannelRequest`: `{ documentId, peerInstanceId }` -- open a Yjs sync channel to a peer
- `FederatedGrant`: `{ documentId, peerInstanceId, role, grantedBy }` -- share a document with a peer
- `KBSubscription`: `{ collectionId, peerInstanceId }` -- subscribe a peer to a KB collection
- `SplitBrainEvent`: `{ documentId, localState, remoteState }` -- detected divergence on reconnect
- `Peer`: registered peer with verified public key and status
- `FederatedIdentityRecord`: identity mapping with verification timestamp
- `SyncChannel`: active bidirectional Yjs sync channel
- `FederatedPermission`: cross-instance permission grant with revocation support
- `KBFederationEntry`: federated KB entry with sync status and jurisdiction
- `SplitBrainResolution`: merge result with conflict details and audit trail
- Outbound WebSocket connections to peer instances for Yjs sync
- Outbound HTTP to peer JWKS endpoints for OIDC token verification
- Emits domain events: PeerRegistered, SyncChannelOpened, PermissionFederated, KBEntrySynced, SplitBrainDetected, SplitBrainResolved
- Writes to federated_identities, federated_permissions, kb_federation tables
- Every federated message MUST be signed with the sender's Ed25519 private key
- Every received message MUST have its Ed25519 signature verified before processing
- Identity mappings are unique per (remoteInstanceId, remoteUserId) pair
- Federated permissions MUST NOT exceed the role granted by the sharing instance
- KB entries with a jurisdiction field MUST NOT auto-merge across different jurisdictions
- Split-brain events MUST be logged in the audit trail
- Revocation messages propagate within one sync cycle
- SAML assertions MUST have XML signature validated before identity extraction
- `auth` -- OIDC token verification, JWKS fetching
- `permissions` -- role/action evaluation for federated grants
- `collab` -- Yjs document state loading/saving
- `events` -- domain event emission
- `audit` -- split-brain event logging
- `storage` -- Yjs state persistence
- MUST: Verify Ed25519 signatures on all incoming federated messages
- MUST: Sign all outgoing federated messages with instance private key
- MUST: Verify OIDC tokens from federated instances against their published JWKS
- MUST: Validate SAML assertion XML signatures before extracting identity
- MUST: Enforce permission ceiling (federated role cannot exceed granted role)
- MUST: Track sync metadata for all shared documents
- MUST: Flag KB entry conflicts as "diverged" when jurisdiction mismatch detected
- MUST NOT: Trust unverified peer identities
- MUST NOT: Auto-merge KB entries across jurisdictions
- MUST NOT: Store peer private keys (only public keys)
- MUST NOT: Bypass local permission checks for federated users
- Ed25519 signing/verification -> Unit test: sign message, verify with correct key, reject with wrong key
- Identity mapping uniqueness -> Integration test: attempt duplicate mapping, assert rejection
- Permission ceiling -> Property test: generate random role pairs, assert federated role never exceeds granted
- KB jurisdiction isolation -> Unit test: attempt cross-jurisdiction merge, assert rejection
- Split-brain detection -> Unit test: create diverged states, assert detection and audit logging
- SAML validation -> Unit test: valid/invalid XML signatures, assert correct accept/reject
- Revocation propagation -> Integration test: revoke permission, assert peer receives revocation
