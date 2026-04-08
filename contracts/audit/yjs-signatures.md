# Contract: audit/yjs-signatures

## Purpose

Ed25519-signed Yjs updates for non-repudiable edit history. Each binary CRDT diff is signed by the author's key before application, creating cryptographic attribution for every change.

## Inputs

- `update: Uint8Array` -- Raw Yjs binary update (CRDT diff).
- `actorId: string` -- User ID of the author.
- `documentId: string` -- Document being edited.
- `privateKey: KeyObject` -- Ed25519 private key for signing.
- `publicKey: KeyObject` -- Ed25519 public key for verification.

## Outputs

- `SignedUpdate`: `{ update: Uint8Array, signature: string (base64), actorId: string, documentId: string, timestamp: string (ISO), updateHash: string (SHA-256 hex) }` -- A signed Yjs update with cryptographic attribution.
- `SignatureVerifyResult`: `{ documentId: string, totalUpdates: number, verified: boolean, failedAt: number | null, failedActorId: string | null }` -- Result of verifying all update signatures in a chain.

## Side Effects

- Inserts rows into `yjs_update_signatures` table (append-only).
- Reads Ed25519 public keys from `user_signing_keys` table.

## Invariants

- Each signature covers: SHA-256(update bytes) + documentId + actorId + timestamp.
- Ed25519 signatures use Node.js built-in `crypto.sign`/`crypto.verify` (no external deps).
- Signatures are stored alongside updates, never modifying the update bytes.
- Verification is independent -- any party with the public key can verify.
- Key pairs are generated per-user, stored in `user_signing_keys`.

## Dependencies

- `audit` -- Parent module; signatures extend the audit trail.
- `config` -- No additional config needed (Ed25519 is deterministic).

## Boundary Rules

- MUST: Sign every Yjs update before storage.
- MUST: Include update hash, documentId, actorId, and timestamp in signed payload.
- MUST: Use Ed25519 (not RSA, not ECDSA).
- MUST: Store signatures in append-only table.
- MUST: Support full chain verification per document.
- MUST NOT: Modify Yjs update bytes.
- MUST NOT: Store private keys in the audit trail.
