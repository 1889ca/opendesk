# Agent-First Development

OpenDesk is built using an agent-first development model. This document describes what that means, why we chose it, and how it works in practice.

## The Model

Traditional open source follows a familiar pattern: humans write code, humans review code, humans merge. The bottleneck is always human availability and attention.

OpenDesk inverts this. Humans define *what* to build and *why*. AI agents handle the *how* -- building, testing, reviewing, and merging. Humans audit the output and steer the direction.

This is not "AI-assisted development," where a human writes code with copilot suggestions. It is a fundamentally different model where AI agents are the primary workforce and humans are the architects and auditors.

## Why Agent-First?

**Scalability.** Agent labor has near-zero marginal cost. Once the infrastructure exists, spinning up another builder or reviewer costs nothing. The project can move faster than any human team without hiring.

**Consistency.** Agents follow the contracts-first methodology rigorously. They do not get tired, skip tests, or cut corners on Friday afternoons. Every module gets the same level of attention whether it is the first or the hundredth.

**Transparency.** Every agent action is logged. Every decision has an audit trail. Every PR has a machine-readable rationale. In practice, this produces more transparency than most human-driven projects, where decisions happen in Slack threads that disappear.

**Accessibility.** Anyone can propose features regardless of coding ability. The barrier to contribution shifts from "can you implement this?" to "can you describe what you need and why?" This opens the project to domain experts, users, and designers who would otherwise be shut out.

**Maintainer sustainability.** Open source maintainer burnout is an industry-wide crisis. In this model, agents handle the grind -- the repetitive PRs, the dependency updates, the test fixes. Humans focus on direction, architecture, and the parts of the work that require judgment.

## The Workflow

### Issue to Merge

1. **Human files an issue** describing the problem or feature need. Clear description of the *what* and *why*, not the *how*.
2. **Planner agent** picks up the issue, breaks it into subtasks, identifies affected contracts, and estimates scope.
3. **Builder agent** creates a branch, implements following contracts, and writes tests. No mocks -- real integration tests against real services.
4. **Automated test suite runs.** Comprehensive, property-based where applicable.
5. **Reviewer agent #1** audits the PR against contracts. Checks for security issues, code quality, and architectural coherence.
6. **Reviewer agent #2** performs an independent review. Different model, different perspective.
7. **Automated security scan** via static analysis.
8. **All gates pass?** Auto-merge to `dev`.
9. **Any gate fails?** Feedback loops to the builder agent. Iterate until all gates pass or the issue is escalated to a human.

### Restricted Zones

Some areas of the codebase are too sensitive for fully automated merges. When a PR touches a restricted zone (authentication, billing, governance, cryptographic operations, license compliance), the workflow changes:

- Agent review still happens as normal.
- Merge is blocked until a human maintainer explicitly approves.
- The human can approve, request changes, or reject.
- This is a hard gate, not a suggestion.

Restricted zones are defined in the repository configuration and enforced by CI.

## Agent Types

| Role | Responsibility |
|------|---------------|
| **Planner** | Breaks issues into subtasks, identifies affected contracts, estimates scope, sequences work |
| **Builder** | Implements code following contracts, writes tests, iterates on review feedback |
| **Reviewer** | Audits PRs for contract compliance, security, quality, and architectural coherence |
| **Maintainer** | Handles dependency updates, refactoring, tech debt reduction, and housekeeping |
| **Architect** | Proposes structural changes, runs multi-model deliberations for major decisions |

Agents are not monolithic. A single agent session handles a single concern. Complex features involve multiple agents coordinating through the issue tracker and PR system, not through shared state.

## Quality Assurance

The quality model assumes agents will make mistakes. The system is designed to catch those mistakes before they reach users.

- **Every module has property-based tests.** Not just happy-path unit tests -- tests that explore edge cases through randomized inputs.
- **Integration tests use real services.** No mocks, no stubs, no fake databases. If a test passes, it passes against the real thing.
- **Reviewer agents are adversarial.** They are explicitly incentivized to find flaws, not to rubber-stamp. A reviewer that approves everything is a broken reviewer.
- **Human audit is a sampling function.** Maintainers spot-check 10-20% of merged PRs in detail. Statistical quality control, not exhaustive review.
- **Weekly architecture review.** Humans review the overall direction, check for drift, and course-correct. This is where the "steering" happens.
- **Contracts are the source of truth.** If the code does not match the contract, the code is wrong. This gives reviewers (agent and human alike) an unambiguous standard.

## Anti-Patterns

We are aware of the failure modes of this approach and actively mitigate them.

**PR farming (quantity over quality).** If agents are rewarded for volume, they will produce volume. Mitigation: agents are evaluated against contract verification, not PR count. A PR that fails review costs more than no PR at all.

**Rubber-stamp reviews.** If reviewer agents are too agreeable, defects slip through. Mitigation: reviewers are adversarial by design, and we track their defect detection rate. A reviewer that never rejects is flagged for recalibration.

**Drift from human intent.** Over time, agent-driven changes can drift from what humans actually wanted. Mitigation: weekly architecture reviews, clear issue descriptions, and contracts that encode intent in machine-verifiable form.

**Monoculture.** If all agents use the same model, they share the same blind spots. Mitigation: multi-model deliberation via hivemind for architectural decisions. Builder and reviewer agents use different models where possible.

**Overconfidence in automation.** The system works until it doesn't. Mitigation: restricted zones for sensitive code, human sampling of merged PRs, and a culture that treats "the agent got it wrong" as a normal event to learn from rather than a crisis.

## Honest Assessment

This model is experimental. It works well for certain kinds of work (well-specified features with clear contracts, refactoring, dependency management) and less well for others (novel architecture, ambiguous requirements, taste-driven design decisions).

We are not claiming this is the future of all software development. We are claiming it is a viable model for building a specific kind of project -- one with clear contracts, strong test infrastructure, and humans who are willing to define intent precisely.

The approach will evolve as we learn what works and what does not. This document will be updated accordingly.

## License

OpenDesk is licensed under AGPL-3.0. This methodology document is part of the project and shares the same license.
