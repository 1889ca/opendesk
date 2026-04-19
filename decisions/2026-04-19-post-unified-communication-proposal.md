# Proposal: "Post" — Unified Communication Super-Pillar

**Date:** 2026-04-19
**Status:** Proposed (awaiting hivemind deliberation + human review)
**Branch:** `claude/unified-communication-tool-BuUp0`
**Full design:** [`docs/design/post-unified-communication.md`](../docs/design/post-unified-communication.md)

## Context

OpenDesk's four super-pillars (Documents, Sheets, Slides, Knowledge Base)
cover creation and reference storage. Every real organization that would
adopt OpenDesk for sovereignty reasons still runs a separate mail system
(Exchange / Workspace) and a separate chat system (Slack / Teams) on
foreign-controlled infrastructure. That is two of the three largest data
stores in the typical knowledge-work org sitting outside the sovereign
stack we're building.

No existing open-source project unifies mail and chat credibly. Mailpile,
Delta Chat, Zulip, Rocket.Chat, Mattermost, Matrix — all address one
paradigm and treat the other as an afterthought.

## Proposal

Add a fifth super-pillar, tentatively named **Post**, that:

1. Treats every message as a first-class citizen — no email-in-chat
   wrapper, no chat-in-email wrapper.
2. Exposes one primitive (Conversation) that subsumes DMs, channels,
   email threads, mailing lists, shared inboxes, announcements.
3. Replaces message *type* with message *delivery mode* (inbox / stream
   / urgent / broadcast / side), sender-hinted and recipient-overridable.
4. Provides one unified triage UX with two reading postures (Queue,
   Flow) drawing from the same data model.
5. Runs SMTP ingress/egress natively (DKIM/DMARC/ARC, threading) so
   external email participants are real peers.
6. Federates tenant-to-tenant via cross-sovereign federation (C5).
7. Reuses every existing cross-cutting pillar: C1 AI for triage/summary,
   C2 audit for every send/edit/delete, C3 erasure with verifiable
   tombstones, C4 workflows as triggers/actions, C5 federation as
   transport, C6 observability for compliance dashboards.
8. Serves personal users (single-seat workspace + SMTP bridge to replace
   Gmail/Outlook) and organizations (channels, shared inboxes, legal
   hold) from the same codebase.

## Why now

- **Strategic:** The sovereignty pitch is incomplete without mail+chat.
  Competitors (Nextcloud Talk, CryptPad) don't cover this either. First
  mover wins.
- **Architectural:** The platform substrate is ready. CRDT sync is
  proven; audit is chained; federation is scoping up; KB gives us a
  first-class entity graph for mentions; AI BYOM gives us local
  triage. We are not building from zero — we are composing.
- **User-pull:** Every maintainer conversation about OpenDesk hits the
  same wall: "but we still need email." This closes that gap.

## Why not now

Reasons to defer, honestly enumerated:

- **Scope.** This is a super-pillar, not a feature. Conservatively a
  6–12 month initiative before MVP parity with Slack + basic mail.
- **SMTP is a tar pit.** Spam, threading edge cases, S/MIME, DKIM key
  rotation, bounce handling, arrival time skew. Underestimating this
  is the default failure mode.
- **Push notifications & mobile.** A chat product without push is dead.
  PWA push may be sufficient but needs validation.
- **E2EE pressure.** Users expect Signal-grade encryption for DMs. If
  we ship without it, we owe a credible roadmap.
- **Sheets/Slides/KB polish.** They are 98% complete. Shipping Post at
  v1 risks deferring 1.0 of the existing pillars.

Mitigations for each appear in `docs/design/post-unified-communication.md`
§10 (phased roadmap).

## Alternatives considered

1. **Integrate with existing mail/chat tools via IMAP + Slack API.**
   Rejected: perpetuates the sovereignty hole; every integration is an
   export route to a foreign vendor.
2. **Ship a Matrix client as the OpenDesk chat layer.** Rejected:
   Matrix is a protocol worth federating with, not a UX to inherit.
   Its state-resolution and room model don't fit email use cases.
3. **Ship email only (Phase 1), chat later.** Rejected: keeps the
   dual-product pain that motivated this proposal. The whole point is
   unification.
4. **Ship chat only.** Rejected: same reason, symmetric.
5. **Do nothing; stay scoped to authoring + knowledge.** Viable. But
   customers who need sovereignty need *communication* sovereignty most
   of all. This is the keystone pillar, not an optional one.

## Decision required

Maintainers, please deliberate on:

1. **Accept the pillar in principle?** Yes / no / revise.
2. **Name.** "Post" is the working name; alternatives in §11 of the
   design doc.
3. **Sequencing.** After Sheets/Slides 1.0 ship? In parallel with C5
   federation? Blocking v1.0?
4. **Module split.** One module or three? The design leans "one now,
   split when SMTP lands."
5. **E2EE scope for v1.** Design the schema for it, ship without it,
   commit to ship-by-v2?

Action items if accepted:

- Run a formal hivemind deliberation via `scripts/deliberate.sh` on the
  open questions in the design doc §11.
- Open a tracking issue per roadmap item (§10).
- Lock the contract boundary in `contracts/post/rules.md` before any
  code lands.
- Register the super-pillar in `docs/mvp.md`.

## Appendix — relationship to existing decisions

- Extends **#011 Super-Pillar Restructuring** (2026-04-08) by adding a
  fifth pillar at the same tier as Documents / Sheets / Slides / KB.
- Depends on **Pillar C5 Federation** for cross-tenant conversations.
  Post is likely C5's first major consumer and should inform its
  transport contract.
- Depends on **C3 Verifiable Erasure** (CRDT pruning). Messages are
  Yjs-backed and participate in the same erasure story as Documents.
- Touches restricted zones (`modules/auth/`, `modules/permissions/`,
  `modules/sharing/`). Schema extensions to support conversation-scoped
  grants will require human maintainer sign-off per CLAUDE.md.
