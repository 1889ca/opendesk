# Contract: erasure

## Purpose

Verifiable data erasure module — provides policy-driven retention rules, cryptographic erasure attestations, and GDPR Right to Be Forgotten compliance. Builds on existing purge compaction and audit proof infrastructure.

## Inputs

- `documentId` — Target document for erasure operations.
- `RetentionPolicy` — Rules defining when documents should be purged (by age, type, or explicit request).
- `ErasureRequest` — Explicit request to erase a document's CRDT history (GDPR SAR, admin action).

## Outputs

- `ErasureAttestation`: Cryptographic proof that data was destroyed at a specific time, linked to the audit chain.
- `RetentionScan`: Results of a retention policy evaluation showing documents due for pruning.

## Side Effects

- Triggers purge compaction on documents matching retention policies.
- Appends erasure events to the audit HMAC chain.
- Stores attestations in `erasure_attestations` table.

## Invariants

- Every erasure produces a cryptographic attestation (never silent deletion).
- Attestations include: pre-erasure state hash, post-erasure state hash, timestamp, actor.
- Retention policies never auto-delete without an attestation trail.
- Erasure is idempotent — re-erasing an already-purged document produces a new attestation but no state change.

## Dependencies

- `collab` — Purge compaction for CRDT history destruction.
- `storage` — Document loading, Yjs state persistence.
- `audit` — HMAC chain for erasure event recording.
- `config` — Retention policy configuration.
- `logger` — Structured logging.

## Boundary Rules

- MUST: Produce an attestation for every erasure operation.
- MUST: Record erasure events in the audit HMAC chain.
- MUST: Support configurable retention policies per document type.
- MUST: Expose retention scan results before auto-pruning (dry-run mode).
- MUST NOT: Delete documents without attestation.
- MUST NOT: Bypass permission checks for erasure operations.

## Verification

- Attestation integrity: Erase document, verify attestation hashes match actual state transitions.
- Retention scan: Configure 30-day policy, create old documents, verify scan identifies them.
- Idempotency: Erase same document twice, verify both attestations valid but second shows no state change.
- Audit integration: Erase document, verify audit chain includes erasure event.
