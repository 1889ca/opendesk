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
GDPR-compliant data erasure tooling for Yjs CRDT documents: tombstone extraction, structural anonymization, targeted redaction, KB cascade erasure, and policy-driven automated pruning.
- `docId`: `string` -- UUID of the target document.
- `targetUserId`: `string` -- User whose data should be erased/anonymized.
- `pattern`: `string` -- Content pattern for targeted redaction (optional, alternative to userId).
- `legalBasis`: `string` -- Legal justification for the erasure (e.g. "GDPR Art. 17").
- `requestedBy`: `string` -- Actor ID of the person requesting erasure.
- `retentionPolicy`: `RetentionPolicy` -- Rule definition for automated pruning.
- `crdtState`: `Uint8Array` -- Raw Yjs document state for tombstone operations.
- `TombstoneReport`: `{ docId, tombstones: TombstoneEntry[], extractedAt }` -- Report of all tombstoned content in a document.
- `AnonymizationResult`: `{ docId, targetUserId, itemsAnonymized, newState }` -- Result of structural anonymization.
- `RedactionResult`: `{ docId, redactedCount, attestation }` -- Result of targeted redaction with attestation.
- `ErasureAttestation`: `{ id, docId, type, actorId, legalBasis, hash, issuedAt }` -- Cryptographic proof of erasure.
- `CascadeResult`: `{ sourceEntryId, affectedDocuments, notificationsSent, attestation }` -- Result of KB cascade erasure.
- `PrunePreview` / `PruneResult`: `{ matchedEntries, wouldDelete/deleted, dryRun }` -- Preview or result of policy-driven pruning.
- Modifies Yjs document state (zero-fills tombstone payloads, redacts content).
- Creates erasure attestation records in `erasure_attestations` table.
- Emits `ErasureCompleted` events via EventBus.
- Sends notifications to document owners during cascade erasure.
- Archives tombstone data to sealed storage before purging.
- Anonymization MUST preserve CRDT vector clocks and structural pointers.
- Every erasure operation MUST produce an attestation with HMAC hash.
- Tombstone extraction MUST run before anonymization (archive-then-purge).
- Cascade erasure MUST replace KB references with "[Removed]" placeholder, never silently delete.
- Retention policies MUST support dry-run mode before execution.
- No erasure operation may run without a `legalBasis` string.
- `collab` -- Provides Yjs document state access and compaction utilities.
- `audit` -- Records erasure events in the audit trail.
- `events` -- Emits erasure domain events.
- `storage` -- Archives sealed tombstone data.
- `permissions` -- Gates erasure endpoints to admin/owner roles.
- `config` -- Provides HMAC secret for attestation hashing.
- MUST: Require legal basis for all erasure operations.
- MUST: Generate cryptographic attestation for every erasure.
- MUST: Preserve CRDT structural integrity during anonymization.
- MUST: Archive tombstones before purging.
- MUST: Notify affected document owners during cascade erasure.
- MUST: Support dry-run mode for retention policy pruning.
- MUST NOT: Silently delete content without audit trail.
- MUST NOT: Break CRDT sync capability (vector clocks must remain valid).
- MUST NOT: Execute retention policies without explicit scheduling.
- CRDT integrity: Anonymize a document, verify other clients can still sync.
- Attestation chain: Perform erasure, verify attestation hash is valid HMAC.
- Cascade completeness: Erase a KB entry, verify all referencing documents are updated.
- Dry-run accuracy: Run prune in dry-run, compare output to actual prune results.
- Tombstone extraction: Insert + delete content in Yjs doc, verify tombstones are reported.
