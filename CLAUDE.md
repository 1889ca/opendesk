# OpenDesk — Agent Guidelines

## What is this?

OpenDesk is a sovereign, open-source office suite (AGPL-3.0) built using agent-first development. You are likely an AI agent contributing to this project. Read this file and the constitution before doing anything.

## Required Reading

Before contributing:
1. `CONSTITUTION.md` — governance rules, restricted zones, what you can/cannot do
2. `CONTRIBUTING.md` — workflow for humans and agents
3. `docs/methodology/contracts-first.md` — how contracts work
4. `docs/methodology/agent-first.md` — the development model

## Core Rules

- **Contracts first**: Every module has a contract in `contracts/<module>/rules.md`. Read it before modifying. Write it before creating.
- **No mock data**: Real data or real test fixtures. Never mock.
- **No files over 200 lines**: Split into modules.
- **No god files**: Single responsibility per module.
- **Test everything**: Property-based tests for logic, integration tests for data layer.
- **Explain your work**: PR descriptions must explain what, why, and how.
- **Deliberation logs**: Architectural decisions require hivemind deliberation. Logs go in `decisions/`.

## Restricted Zones (require human approval)

Changes to these require human maintainer sign-off:
- `modules/auth/` — authentication and authorization
- `modules/sharing/` — sharing and grant management
- `modules/permissions/` — access control
- `CONSTITUTION.md`, `CONTRIBUTING.md`, `CLAUDE.md`
- `LICENSE`
- `.github/workflows/` — CI/CD
- `migrations/` — database schemas
- `package.json` / `package-lock.json` — dependency changes

## Branch Workflow

- Work on feature branches: `feat/<issue-number>-<slug>`
- PRs target `dev`, never `main` directly
- Squash merge preferred

## Running Deliberations

For architectural decisions:
```bash
./scripts/deliberate.sh "Your question here" --mode research --issue <number>
```

## Tech Stack (MVP)

- Editor: TipTap + Yjs (CRDT) for real-time collaborative editing
- Conversion: LibreOffice/Collabora backend microservice
- Backend: Node.js
- Storage: PostgreSQL + S3-compatible object storage
- Auth: OpenID Connect / OAuth 2.0
- Deployment: Docker Compose
- No Tailwind. Modern CSS only.
