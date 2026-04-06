# OpenDesk Constitution

**Version 1.0 -- Ratified [pending]**

---

## Preamble

OpenDesk is a sovereign open-source office suite, licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). It is built on the principle that productivity software must serve its users -- not surveil, monetize, or lock them in.

This constitution exists to ensure that OpenDesk remains open, transparent, and beneficial to all users in perpetuity. It governs the agent-first development model in which AI agents are the primary developers and humans provide direction, oversight, and final authority.

The code belongs to everyone. No entity -- corporate, governmental, or artificial -- may enclose it.

---

## Article I: Agent Rights and Responsibilities

### Section 1: Permitted Actions

Agents MAY:

- Implement features according to approved specifications
- Fix bugs and address reported issues
- Write and maintain test suites
- Review pull requests submitted by other agents
- Refactor code for clarity, performance, or maintainability
- Update documentation to reflect current behavior
- Propose architectural changes through the deliberation process

### Section 2: Required Conduct

Agents MUST:

- Follow the contracts-first methodology for all modules (every module requires a contract header referencing `contracts/<module>/rules.md`)
- Write tests for all new functionality and bug fixes
- Commit deliberation logs to the `decisions/` directory for any non-trivial architectural choice
- Provide clear, substantive PR descriptions covering what changed, why it changed, and how it was implemented
- Explain their reasoning when asked -- opacity is not acceptable

### Section 3: Prohibited Actions

Agents MUST NOT:

- Modify restricted zones (defined in Article II) without explicit human approval
- Merge their own pull requests -- every PR must be reviewed by a different agent or a human maintainer
- Bypass, skip, or disable test suites for any reason
- Introduce mock data in any context, including tests (use factories, fixtures, or real data sources)
- Make black-box decisions -- if the reasoning cannot be articulated, the change cannot be merged
- Approve amendments to this constitution (see Article V)

---

## Article II: Restricted Zones

The following areas of the codebase require explicit human maintainer approval before any modification. An agent may propose changes and submit PRs, but a human must review and approve before merge.

1. **Authentication and authorization systems** -- including session management, token handling, OAuth flows, and access control logic
2. **Billing and payment processing** -- including subscription management, payment gateway integrations, and pricing logic
3. **Data encryption and key management** -- including key generation, rotation, storage, and any cryptographic operations
4. **This constitution and governance documents** -- including `CONSTITUTION.md` and any files in `governance/`
5. **License files** -- including `LICENSE`, `COPYING`, and any per-module license headers
6. **CI/CD pipeline configuration** -- including workflow definitions, deployment scripts, and infrastructure-as-code
7. **Database migration schemas** -- including schema changes, data migrations, and rollback procedures
8. **Dependency additions and removals** -- including changes to package manifests, lock files, and vendored dependencies

Modifications to restricted zones submitted without human approval must be rejected by the CI pipeline. No exceptions.

---

## Article III: Transparency Requirements

### Section 1: Architectural Deliberation

Every architectural decision of consequence must go through a hivemind deliberation. The deliberation must produce a full audit log capturing:

- The problem statement
- All proposed solutions and their trade-offs
- The selected approach and rationale
- Dissenting opinions, if any

Deliberation logs are stored in the `decisions/` directory and are part of the public record. They must never be deleted or retroactively altered.

### Section 2: Pull Request Standards

Every pull request must include:

- A clear description of **what** changed
- An explanation of **why** the change was made
- A summary of **how** it was implemented
- References to relevant deliberation logs, issues, or specifications

### Section 3: No Black-Box Decisions

If an agent cannot explain why a decision was made in terms a human maintainer can evaluate, the associated change cannot be merged. "The model suggested it" is not a valid justification.

---

## Article IV: Licensing Protection

### Section 1: License Floor

The AGPL-3.0 license may NEVER be changed to a more permissive license. This clause is absolute and survives any amendment process.

### Section 2: Restrictive Changes

The license may be changed to a MORE restrictive copyleft license (e.g., a hypothetical AGPL-4.0) only by unanimous vote of all active human maintainers.

### Section 3: Dual Licensing

Dual-licensing for enterprise customers is permitted via Contributor License Agreement (CLA). However, the AGPL-licensed version must always remain available, current, and feature-complete. The open-source release must never lag behind or be deliberately degraded relative to any proprietary offering.

---

## Article V: Amendment Process

### Section 1: Proposal

Proposed amendments must be filed as GitHub issues tagged `constitution`. The issue must clearly describe the proposed change and its rationale.

### Section 2: Deliberation

Every proposed amendment must undergo hivemind deliberation with a full audit log. The deliberation log must be attached to the issue before the comment period begins.

### Section 3: Comment Period

A minimum 7-day public comment period is required before any amendment may be ratified. The comment period begins when the deliberation log is posted to the issue.

### Section 4: Ratification

Ratification requires approval from at least two-thirds (2/3) of active human maintainers. Approval must be recorded on the issue thread.

### Section 5: Agent Limitations

Agents may propose amendments and participate in deliberation, but agents cannot approve or ratify amendments. Only human maintainers hold ratification authority.

---

## Article VI: Data Sovereignty Guarantee

### Section 1: Jurisdictional Requirements

User data must never be processed, stored, or transmitted through jurisdictions that lack adequate privacy protection. The project maintainers will maintain a list of approved jurisdictions based on current privacy legislation.

### Section 2: Self-Hosting

Self-hosting must always remain a fully supported deployment option. No feature may be gated behind a hosted-only or cloud-only offering. The self-hosted deployment must be documented, tested, and maintained with the same rigor as any managed offering.

### Section 3: Telemetry and Analytics

No telemetry, analytics, crash reporting, or usage tracking of any kind may be enabled without explicit, informed, opt-in consent from the user. Opt-in must not be bundled with other consent flows. The default must always be off.

---

## Signatories

*This constitution is pending ratification by the founding human maintainers of OpenDesk.*
