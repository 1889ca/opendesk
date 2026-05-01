# Post — Unified Communication

**Status:** Proposal / exploration
**Author:** Claude (agent) via `claude/unified-communication-tool-BuUp0`
**Scope:** New super-pillar proposal. No code yet.

> "Post" is a working name. Alternatives: Relay, Conduit, Threads, Messages. See §11.

## 1. Thesis

Email treats every message as a letter. Chat treats every message as a shout.
Neither is right. Both are also right — for different messages, different
recipients, different moments. The state of the art today is to run two
separate products side-by-side (Gmail + Slack, Outlook + Teams) and paper
over the seams with integrations, @-mentions that email you, and Slack
Connect.

OpenDesk already owns the substrate those two products duplicate:
identity, permissions, audit, federation, erasure, real-time sync (Yjs),
attachments (Documents/Sheets/Slides), knowledge (KB), workflows. What's
missing is a communication surface that is a **peer** to Docs/Sheets/
Slides/KB — not a bolt-on chat widget, not an email importer.

**Post** is that surface. One app, one inbox, one addressable identity,
one audit trail. Email is a first-class citizen. Chat is a first-class
citizen. The user — not the protocol — decides which paradigm fits each
message.

## 2. The core primitive: the Conversation

Forget "channel," "DM," "thread," "email," "mailing list." A single
primitive covers them all:

```
Conversation {
  id, workspace_id
  participants:   Set<Identity>      # internal users, external emails, federated peers
  participation:  'closed'|'invite'|'workspace'|'public'  # who may join
  topic?:         string             # human label (like a subject or channel name)
  root_message:   Message
  ...
}
```

Examples:
- 1:1 email-style conversation with an external supplier → 2 participants,
  `closed`, reached via SMTP.
- #engineering channel → N participants, `workspace` policy.
- Announce broadcast → 1 sender, M recipients, `closed`, read-only replies.
- Shared inbox `support@acme.ca` → 1 logical participant backed by a team,
  SMTP ingress, internal triage notes hidden from external view.

A conversation is not an inbox folder. The inbox is a **query** — "give
me conversations that currently want my attention" — not a container.

## 3. Messages have modes, not types

A message has content (rich text via the same TipTap stack as Docs). What
varies is **delivery mode**, chosen at send time:

| Mode        | Sender intent                            | Default recipient UX     |
|-------------|------------------------------------------|--------------------------|
| `inbox`     | "Needs your attention, respond later"    | Queue, bolded            |
| `stream`    | "FYI, live if you're here"               | Flow, no badge           |
| `urgent`    | "Interrupt me now"                       | Toast + push             |
| `broadcast` | "No reply expected"                      | Banner, collapsible      |
| `side`      | "Comment about the thread, not in it"    | Margin note              |

Recipients override per-sender and per-conversation. An intern's `urgent`
to the CTO is downgraded automatically by the CTO's rules; a spouse's
`stream` message can be elevated. The sender's intent is a hint, not a
demand — the opposite of email, where Importance headers are ignored,
and the opposite of Slack, where *everything* is an interrupt.

This is the single move that lets one product serve email *and* chat
without demoting either.

## 4. Identity, addressing, federation

Every Post identity has three equivalent addresses:

1. `user@workspace.opendesk` — internal canonical
2. `user@workspace.example.com` — SMTP, real RFC-5322 deliverable
3. `@user:workspace` — federated (C5), Matrix-style

Inbound:
- SMTP ingress lands in Post. Threading via `Message-ID`/`In-Reply-To`
  plus heuristics (subject, participant set) joins it to the right
  Conversation.
- Federated peers deliver natively through the C5 federation transport.
- Internal messages never touch SMTP.

Outbound:
- Replies to an external-participant conversation go out as SMTP with
  proper headers, DKIM/DMARC/ARC signed, S/MIME-ready.
- Replies inside an all-internal conversation stay internal.
- Mixed conversations fan out per-participant: internal-native for
  OpenDesk users, SMTP for external addresses, federated for peers.

The user composes **once**. The system picks the wire.

## 5. Integrations with existing pillars

Post is valuable because of what's already here:

- **Documents / Sheets / Slides** — `@-attach` any doc; the recipient
  opens the *same* collaborative artifact, not a copy. Revoke share
  when the conversation is archived if policy says so.
- **Knowledge Base (KB)** — mentions of people, orgs, and terms reuse
  the KB entity picker. A conversation can be promoted to a KB Note,
  turning triage into durable institutional memory.
- **Workflows (C4)** — triggers on `message.received`,
  `conversation.tagged`, regex patterns, NLP intent. Example: "when a
  support@ message contains a refund request, create a task, assign to
  on-call."
- **AI (C1, BYOM, air-gapped)** — local summarization of long threads,
  draft replies, triage suggestions, "who owns this?" attribution, tone
  check. Never sends content to a hosted model unless the workspace
  explicitly opts in.
- **Audit (C2)** — every send, edit, delete, read-receipt, and erasure
  is HMAC-chained. Forensically reproducible.
- **Erasure (C3)** — a subject-of-erasure's contributions can be
  redacted with a verifiable tombstone; Yjs-backed history supports
  this cleanly (already proven for Docs).
- **Federation (C5)** — Post is the obvious first use of cross-sovereign
  federation. Two OpenDesk tenants talk like Matrix servers.

## 6. Flow vs Queue — one UI, two reading postures

Users choose, per-conversation or per-view, between two rendering
postures:

- **Flow**: chronological, flat-with-threads, presence indicators, typing,
  read receipts if enabled. Looks and feels like Slack / iMessage.
- **Queue**: reverse-chronological list of conversations, bold-unread,
  keyboard triage (archive / snooze / assign / reply), swipe actions.
  Looks and feels like Superhuman / Missive.

Both views draw from the same data. There is **one unread counter** per
conversation, not two. Snoozing in Queue hides it from Flow; muting in
Flow stops its Queue attention bump. State is unified; presentation is
chosen.

## 7. Governance, sovereignty, compliance

- Self-host by default; no SaaS requirement.
- SMTP ingress/egress terminates on the tenant's own MX (e.g., Haraka or
  Postfix container shipped with the stack).
- Retention policies per conversation class (e.g., support: 7 years;
  internal banter: 90 days).
- Legal hold via existing e-discovery module.
- DLP hooks on outbound SMTP (block by pattern, workspace-owned
  dictionaries).
- Per-jurisdiction data residency using the existing
  `jurisdiction` field pattern from KB.

## 8. Personal, team, and org

Same software, same primitives, scaled by workspace shape:

- **Personal**: single-user workspace. The killer feature here is
  "unify my Gmail and iMessage into one triage surface on my own
  hardware." SMTP bridge + optional bridges (XMPP, Matrix) bring
  external accounts in.
- **Team / small org**: workspaces, shared inboxes
  (support@, hello@), channels, federation with other OpenDesk orgs.
- **Enterprise**: all of the above plus SSO via existing OIDC,
  retention/e-discovery/DLP, cross-jurisdiction replication, and
  granular permission scopes (the existing `permissions` module is
  extended, not replaced).

## 9. What we deliberately don't do

- **No proprietary emoji reactions format.** Reuse Unicode. Custom
  workspace emoji ship via storage module like any other asset.
- **No separate notifications inbox.** The existing `notifications`
  module handles non-conversation events (KB update, doc shared).
  Post messages are their own thing, not duplicated as notifications.
- **No bot framework in v1.** Workflows (C4) already do this. Defer a
  dedicated bot SDK until we see what users actually script.
- **No voice/video in v1.** Great candidate for v2 and a separate
  pillar; WebRTC belongs with presence, not with text messaging.
- **No "Channels vs DMs" UI split.** Conversations are conversations.
  The sidebar groups them by attention and tag, not by type.

## 10. Phased roadmap (draft)

Numbered for later grooming into milestones on the super-pillar table
in `docs/mvp.md`.

1. **Data model & storage** — `post_conversations`,
   `post_messages`, `post_participants`, `post_delivery` tables.
   Yjs per-conversation doc for live editing of message drafts and
   presence. Contracts in `contracts/post/`.
2. **Internal-only MVP** — send/receive/read within one workspace.
   Flow view only. Mentions, attachments, KB picker reuse.
3. **Queue view & triage keyboard shortcuts** — archive, snooze,
   assign, tag.
4. **Delivery modes** — sender picks, recipient overrides, per-sender
   rules.
5. **SMTP ingress/egress** — MX container, DKIM/DMARC/ARC signing,
   threading heuristics.
6. **Shared inboxes** — team addresses, internal side-notes, round-robin
   assignment.
7. **Federation (C5) integration** — cross-tenant conversations.
8. **Workflows (C4) hooks** — triggers & actions on message events.
9. **AI (C1) assists** — summarize, draft, triage, attribute.
10. **Retention / legal hold / DLP** — policy layer on top of audit.
11. **External-protocol bridges (optional)** — XMPP, Matrix, IMAP pull.

## 11. Open questions for hivemind deliberation

- **Name.** "Post" is evocative but overloaded (blog posts). "Relay"?
  "Threads" (Meta collision)? "Conversations" (too generic)?
- **Contract split.** Is this one module or three (`post-core`,
  `post-smtp`, `post-federation`)? Probably three once SMTP lands;
  start as one to prove the data model.
- **Threading algorithm.** Full JWZ thread reconstruction on SMTP
  ingress, or simpler header-only with manual re-link?
- **End-to-end encryption.** Out of MVP scope for OpenDesk generally,
  but Post is the module where users will ask first. Do we design
  the schema to allow per-conversation key material from day one?
- **Mobile.** OpenDesk's stated position is "responsive web before
  native." Is that survivable for a communication product, where
  push notifications are table stakes? PWA push may be enough.
- **Spam.** SMTP ingress means a spam story is mandatory. rspamd
  container? External scoring? Reputation from federation peers?

## 12. Why this is worth building

Every sovereignty-minded organization we target runs Exchange or
Google Workspace for mail plus Slack/Teams for chat — four vendors,
four data exports, four audit systems, four jurisdictions. Post
collapses that into one module on their infrastructure, with the
*same* audit, erasure, federation, and AI stack as their documents.

That is the OpenDesk thesis applied to the last piece of the office
suite that nobody has unified credibly. Front and Missive got close
but are SaaS-only and don't own the document stack. Superhuman is
email-only. Twist is chat-pretending-to-be-email. None federate.
None erase. None are AGPL.

We can be the first.
