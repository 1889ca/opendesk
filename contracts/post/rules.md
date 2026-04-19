# Contract: post

> **Status:** Proposal stub. Not yet accepted. Do not implement against
> this contract until the design in
> `docs/design/post-unified-communication.md` and the proposal in
> `decisions/2026-04-19-post-unified-communication-proposal.md` have
> been ratified by a hivemind deliberation and human maintainer review.

## Purpose

Provide unified async + sync communication (email + chat) inside
OpenDesk as a first-class super-pillar. One Conversation primitive
subsumes DMs, channels, email threads, shared inboxes, and
announcements; delivery mode (inbox | stream | urgent | broadcast |
side) is a per-message hint that the recipient can override.

## Inputs

- Authenticated send requests (API / editor composer)
- SMTP ingress from the mail gateway (inbound mail)
- Federated events from peer OpenDesk tenants (C5)
- Domain events the module subscribes to (e.g., `document.shared` to
  auto-attach, `workflow.trigger` to post bot-style messages)

## Outputs

- Persisted conversations, messages, participants, delivery records
  in PostgreSQL
- Outbound SMTP via the mail gateway for external participants
- Outbound federation envelopes for peer tenants
- EventBus domain events: `message.sent`, `message.received`,
  `conversation.created`, `conversation.archived`, `participant.added`

## Side Effects

- Writes to `post_*` tables in PostgreSQL
- Writes message bodies to Yjs documents (one per conversation) for
  real-time composition, presence, and typing indicators
- Emits audit log entries (C2) for every mutation
- Enqueues SMTP delivery jobs for external participants
- Enqueues federation envelopes for peer tenants
- Triggers workflow evaluation (C4) on publish

## Invariants

1. Every message has `conversation_id`, `author_identity`,
   `mode`, `content_ref`, `sent_at`, and `delivery_status`.
2. A conversation has exactly one `root_message`. Replies form a DAG
   rooted there (tree in practice; DAG permitted for merge/cross-post).
3. `participation` ∈ {`closed`, `invite`, `workspace`, `public`}
   controls who may join; joining rules are enforced on every read.
4. External participants are represented by `Identity` records with
   `kind = 'smtp'` or `kind = 'federated'`; never by bare email
   strings in the message table.
5. Outbound SMTP is DKIM-signed with the workspace's configured
   signing key; unsigned sends MUST be rejected.
6. Inbound SMTP is threaded into an existing conversation iff
   `In-Reply-To` or `References` matches a known `Message-ID`;
   fallback heuristics (subject + participant set + time window)
   are logged as "fuzzy-threaded" for audit.
7. Delivery mode is stored as-sent and as-overridden separately;
   recipient overrides MUST NOT mutate the sender's record.
8. Every message is covered by the C2 HMAC audit chain. Deleting a
   message writes a tombstone, never removes the chain link.
9. Erasure (C3) applied to a subject-of-erasure redacts their
   `content_ref` and `author_identity` to a verifiable placeholder;
   conversation structure is preserved.
10. Retention policy is evaluated per conversation class; messages
    past retention are soft-deleted with audit, hard-deleted after a
    grace window.

## Dependencies

- `storage` (runtime) — PostgreSQL pool, S3 for attachments
- `collab` (runtime) — Yjs provider for live composition + presence
- `auth` (runtime) — identity resolution, OIDC sessions
- `permissions` (runtime) — conversation-scoped grants (NEW scope;
  requires coordinated change in restricted `permissions` module)
- `events` (runtime) — EventBus publish/subscribe
- `audit` (runtime) — HMAC audit log (C2)
- `erasure` (runtime) — redaction primitives (C3)
- `workflow` (runtime) — triggers/actions (C4)
- `federation` (runtime) — cross-tenant transport (C5)
- `notifications` (runtime) — non-conversation alerts only
- `kb` (runtime) — entity/person picker for mentions
- `ai` (optional runtime) — summarization, draft, triage via BYOM (C1)

## Boundary Rules

### MUST

- Expose Conversation, Message, Participant, DeliveryMode as the only
  public types; hide storage schema behind the module boundary.
- Accept delivery mode from senders as a hint; apply recipient rules
  before surfacing a message in any UI.
- Round-trip SMTP messages with proper `Message-ID`, `In-Reply-To`,
  `References`, `Date`, `From`, `To`, `Cc`, `Subject`, MIME parts,
  and DKIM/DMARC/ARC signatures.
- Treat every message as audit-covered (C2) before acknowledging the
  send.
- Support per-conversation retention policies and legal hold flags.
- Provide a stable public API for workflows (C4) to read, filter, and
  post messages as a workspace-scoped bot identity.

### MUST NOT

- Import any frontend module directly (boundary enforced by barrel file).
- Bypass the audit chain for any mutation — including administrative
  deletions.
- Store plaintext external participant email addresses outside the
  `Identity` table.
- Expose another workspace's conversations across tenant boundaries
  except through the federation transport contract.
- Auto-downgrade `urgent` mode without a recorded recipient rule.
- Implement its own permissions primitives — always delegate to
  `permissions`.
- Implement its own CRDT layer — always use `collab`.

## Verification

How each invariant is tested:

- **Invariants 1–4 (shape & participation):** property-based tests via
  `fast-check` over the Conversation/Message/Participant schema; each
  generated conversation must satisfy the invariants after every
  operation.
- **Invariant 5 (DKIM):** integration test that sends via a local MX,
  verifies the signature with `dkim-verify` against the workspace key.
- **Invariant 6 (threading):** corpus-based integration test using
  real-world mailing list archives (e.g., public LKML threads) to
  confirm `In-Reply-To` linking and the "fuzzy-threaded" fallback
  path logs correctly.
- **Invariant 7 (mode override):** integration test that verifies a
  recipient override does not mutate the sender's record or any
  downstream recipient's view.
- **Invariants 8–9 (audit + erasure):** extend the existing C2/C3
  verification suites to include `post_*` mutations and a
  subject-of-erasure redaction round-trip.
- **Invariant 10 (retention):** time-warped integration test that
  simulates retention expiry and asserts the soft-delete → hard-delete
  transition emits correct audit entries.

## Open contract questions

These are explicitly unresolved and must be closed during
deliberation (see `docs/design/post-unified-communication.md` §11):

- Should the Post module split at contract time into `post-core`,
  `post-smtp`, `post-federation`, or start unified and split at the
  SMTP milestone?
- Does the Identity table belong in `auth` or in `post`? Federated
  and SMTP identities are arguably authentication concerns.
- Does the Conversation participant policy belong to `permissions`
  (principled) or to `post` (pragmatic)?
- E2EE: is there a per-conversation key material column reserved in
  the v1 schema, or do we migrate later? This affects contract shape
  materially.
