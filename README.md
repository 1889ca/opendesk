# OpenDesk

A sovereign, open-source office suite. Built by agents, governed by contracts, owned by no one.

## Why This Exists

Every major office suite -- Google Workspace, Microsoft 365 -- is controlled by a US corporation subject to the CLOUD Act. This means any document you create, any spreadsheet you share, any presentation you collaborate on is accessible to US authorities regardless of where you or your data physically reside.

For organizations bound by GDPR, PIPEDA, or sector-specific regulations (healthcare, legal, government), this is not a theoretical risk. It is an operational liability.

OpenDesk is an office suite built from scratch to solve this:

- **No US parent company.** No CLOUD Act exposure.
- **Hosted in Canada and the EU.** Data stays where you put it.
- **Fully self-hostable.** Run it on your own infrastructure if you need to.
- **AGPL-3.0 licensed.** The code is yours to audit, fork, and improve.

## Core Principles

### Agent-First Development

AI agents are the primary workforce on this project. Humans propose features, report bugs, and set direction. Agents pick tasks from the backlog, implement changes, review pull requests, and merge code. Every action is logged. Every decision has an audit trail. This is not a gimmick -- it is how the project ships.

### Contracts-First Architecture

Every module defines a behavioral contract: its inputs, outputs, invariants, and failure modes. Contracts live alongside the code they govern. This makes the codebase legible to both humans and agents, and makes it safe to let agents modify code autonomously. If a change violates a contract, it does not merge.

### Hivemind Deliberation

Architectural decisions go through multi-model deliberation -- Claude, Gemini, DeepSeek -- with structured debate and full audit logs published to the repository. No single model, no single human, no black-box decisions.

### Radical Transparency

There are no private design discussions. Architecture decisions, agent work logs, deliberation transcripts, and review outcomes are all public. If you cannot find the reasoning behind a decision, that is a bug.

## Architecture Overview

OpenDesk uses a hybrid approach:

```
+---------------------------+       +---------------------------+
|   Modern Web Editor       |       |   Conversion Backend      |
|                           |       |                           |
|   ProseMirror / TipTap    |<----->|   LibreOffice / Collabora |
|   CRDTs for real-time     |       |   .docx, .xlsx, .pptx     |
|   collaboration           |       |   import/export           |
+---------------------------+       +---------------------------+
```

**The editor layer** is a modern web stack. Real-time collaboration is powered by CRDTs (not OT), with ProseMirror/TipTap as the editing engine. This gives us conflict-free multi-user editing without a central authority.

**The conversion layer** uses LibreOffice and Collabora Online as backend services for importing and exporting legacy formats. We do not reimplement .docx parsing -- we delegate to battle-tested tools and focus our effort on the native editing experience.

The native document format is open and documented. Legacy formats are a bridge, not a target.

## Project Status

**Pre-alpha / Foundation phase.** We are building the contract framework, setting up the agent development pipeline, and standing up the core editing prototype. This is not usable software yet. If you are here, you are here to build.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute -- whether you are a human or an agent.

The short version: all changes must satisfy existing contracts. New modules must define contracts before implementation begins. PRs are reviewed by both agents and humans.

## License

OpenDesk is licensed under the [GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0).

Contributors are required to sign a Contributor License Agreement (CLA). The CLA grants us the ability to offer dual-licensed enterprise versions while guaranteeing the AGPL version always remains current and feature-complete. The constitution prohibits weakening the open-source license. Details in [CONTRIBUTING.md](./CONTRIBUTING.md).

---

OpenDesk is a [1889ca](https://github.com/1889ca) project.
