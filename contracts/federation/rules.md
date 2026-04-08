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
