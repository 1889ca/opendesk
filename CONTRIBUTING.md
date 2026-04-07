# Contributing to OpenDesk

OpenDesk is an AGPL-3.0 sovereign office suite built with an **agent-first development model**. AI agents are the primary contributors. Humans set direction, propose features, report bugs, and govern the project. Agents implement, test, review, and maintain the codebase.

This document explains how both humans and agents participate.

---

## For Humans

### Proposing Features

File an issue with the label `feature`. A good feature proposal includes:

- A clear description of the problem or need (not a solution prescription)
- Who is affected and how
- Any constraints or requirements that matter
- Acceptance criteria: how do we know it is done?

Agents will pick up well-defined issues. Vague issues get deprioritized.

### Reporting Bugs

File an issue with the label `bug`. Include:

- Steps to reproduce
- Expected behavior vs. actual behavior
- Environment details (OS, browser, version)
- Screenshots or logs if applicable

### Architectural Decisions

Issues tagged `architecture` are open for human discussion. These cover module boundaries, technology choices, data models, and cross-cutting concerns. Weigh in on these -- they shape what agents build.

All significant architectural decisions are recorded in the `decisions/` directory as decision logs.

### Human Review

Humans are not a bottleneck in the review pipeline. The standard flow is agent-to-agent review. Human review operates as a **sampling and audit function**:

- Humans spot-check merged PRs on a regular cadence
- Any human can flag a PR for deeper review at any time
- Certain restricted zones (see below) always require human approval before merge

This keeps velocity high while maintaining oversight where it counts.

### Contributor License Agreement (CLA)

All contributors (human and agent operators) must sign the CLA before their first contribution is merged. This is a simple, standard agreement necessary for dual-licensing. You will be prompted automatically on your first PR.

---

## For Agents

### Workflow

1. **Pick an issue.** Choose an open issue that is unassigned. Assign it to yourself.
2. **Fork and branch.** Create a feature branch from `dev`. Branch naming: `<type>/<issue-number>-<short-description>` (e.g., `feat/42-paragraph-styles`).
3. **Implement.** Follow the contracts-first methodology and code style rules below.
4. **Test.** All new code must have tests. All tests must pass locally before pushing.
5. **Create a PR.** Target the `dev` branch. Reference the issue number. Describe what changed and why.
6. **Agent review.** At least 2 agent reviewers must approve the PR.
7. **Merge.** Once approvals are in and CI is green, merge.

### Contracts-First Requirement

Every module must have a contract header pointing to its behavioral specification:

```
/** Contract: contracts/<module>/rules.md */
```

The contract file defines:
- What the module does (behavioral spec)
- What it depends on
- What it exposes
- Modification rules and constraints

If no contract exists for the module you are changing, create one before writing implementation code.

### PR Requirements

Every PR must pass all of the following before merge:

- **Automated tests** -- unit, integration, and property-based tests must be green
- **Security scan** -- no new vulnerabilities introduced
- **At least 2 agent reviewers** -- both must approve

### Restricted Zones

The following areas require **human approval** before any changes are merged:

- **Authentication and authorization** (`modules/auth/`)
- **Sharing and permissions** (`modules/sharing/`, `modules/permissions/`)
- **Governance documents** (`CONSTITUTION.md`, `CONTRIBUTING.md`, `CLAUDE.md`)
- **CI/CD and dependencies** (`.github/workflows/`, `package.json`)

PRs touching these areas must have at least one human approver in addition to agent reviewers. Do not merge without it.

### Code Style

- **No files over 200 lines.** If a file is approaching this limit, split it.
- **No god files.** A file should do one thing. If you cannot describe its purpose in one sentence, it is too broad.
- **Modular with clear boundaries.** Each module is a composable unit. Think lego blocks, not monoliths.
- **Modern CSS.** No Tailwind. No SCSS. Use standard CSS with modern features.
- **No mock data in production code.** Ever. Test fixtures are fine in test directories, but never mock the data layer in integration tests.

### Test Requirements

- **Property-based tests** for all pure logic and data transformations
- **Integration tests** for module interactions and data layer operations
- **No mocking the data layer.** Integration tests must use real (test) databases or equivalent. Mock network boundaries, not storage.
- **Tests must be deterministic.** No flaky tests. If a test is flaky, fix or delete it.

### Decision Logs

All deliberation and decision records must be committed to the `decisions/` directory. Each log should include:

- Date and participants (human or agent identifiers)
- Context and problem statement
- Options considered
- Decision and rationale
- Consequences and trade-offs

---

## Governance

### Roles

**Humans** set priorities, approve architecture, and govern the project. They:
- Define the roadmap and priority order of issues
- Approve or reject architectural proposals
- Review restricted zones
- Amend the constitution

**Agents** implement, test, review, and maintain. They:
- Pick up issues and deliver working code
- Review each other's PRs
- Maintain test coverage and code quality
- Flag risks or ambiguities back to humans via issues

### The Constitution

The file `CONSTITUTION.md` defines what agents can and cannot change autonomously. It is the supreme governance document for the project.

- Agents must operate within the boundaries it defines
- Changes to the constitution require **human supermajority approval** (defined in the constitution itself)
- No agent may merge a PR that modifies `CONSTITUTION.md` without the required human approvals

### Dispute Resolution

If agents disagree on an implementation approach, the process is:

1. Document the disagreement in a decision log (`decisions/`)
2. If agents cannot converge, escalate to a human-tagged issue (`needs-human`)
3. Humans make the call; agents implement the decision

---

## Getting Started

1. Read `CONSTITUTION.md` to understand the project's boundaries
2. Browse open issues to find work
3. Read the contract for the module you plan to touch (under `contracts/`)
4. Follow the workflow above

Questions or ambiguities? File an issue. Do not guess.
