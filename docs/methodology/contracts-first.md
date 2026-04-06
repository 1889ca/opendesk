# Contracts-First Development

## Why Contracts-First?

In a project where AI agents are the primary developers, you can't rely on tribal knowledge, verbal agreements, or "the senior dev knows how this works." Every module needs explicit, machine-readable behavioral contracts that agents can verify against. This is how we maintain coherence across hundreds of agent-authored PRs.

Without contracts, agent-driven development drifts fast. One agent adds a side effect to a utility function. Another agent assumes that function is pure. A third agent refactors the caller without checking. By the time a human reviews, the damage is three layers deep. Contracts make the rules explicit so every agent -- regardless of context window or session history -- operates from the same source of truth.

## What is a Contract?

A contract defines a module's behavioral boundaries:

- **Purpose** -- one sentence describing what this module does
- **Inputs** -- what it accepts (types, shapes, invariants)
- **Outputs** -- what it produces (types, shapes, guarantees)
- **Side effects** -- what external state it modifies
- **Invariants** -- what must always be true (pre-conditions, post-conditions)
- **Dependencies** -- what other modules it requires
- **Boundary rules** -- what it may NOT do (e.g., "must not make HTTP calls directly")

A contract is not documentation. It is a specification. The difference matters: documentation describes what code happens to do today. A contract prescribes what code is allowed to do, period.

## Contract File Structure

Contracts live in `contracts/<module-name>/rules.md`. Every source file in the module must reference its contract with a header comment:

```javascript
/** Contract: contracts/editor-core/rules.md */
```

This header serves two purposes:

1. It tells agents where to find the rules before modifying the file.
2. It enables automated auditing -- any source file missing the header is a compliance violation.

The contract file itself is Markdown, not code. This is intentional. Contracts must be readable by any agent, any model, any human -- without parsing a schema or running a type checker.

## Contract Template

Use this template when creating `contracts/<module>/rules.md`:

```markdown
# Contract: <Module Name>

## Purpose
<one sentence>

## Inputs
- <input>: <type> -- <description>

## Outputs
- <output>: <type> -- <description>

## Side Effects
- <effect> -- <when/why>

## Invariants
- <invariant>

## Dependencies
- <module> -- <why>

## Boundary Rules
- MUST: <requirement>
- MUST NOT: <restriction>

## Verification
- <how to test each invariant>
```

Every section is required. If a module has no side effects, write "None." If it has no dependencies, write "None." Empty sections are a code smell -- they suggest the author didn't think it through.

## How Agents Use Contracts

### Before implementing

Read the contract for the module you are modifying. The contract header in the source file points you to it. If the file has no contract header, stop and flag it -- the module needs a contract before it gets more code.

### Before creating a new module

Write the contract FIRST. The contract gets reviewed and approved before any implementation begins. This prevents the common failure mode of writing code and then retrofitting a contract to match whatever you built.

### Before merging

Verify all contract invariants pass via automated tests. The CI pipeline checks:
- Every source file has a contract header
- Every contract has a corresponding test file
- All invariant tests pass

### Before changing a contract

Changing a contract is an architectural decision, not a code change. The process:
1. Propose the change with rationale
2. Run hivemind deliberation to surface consequences
3. Get human approval
4. Update the contract
5. Update all affected code and tests
6. Single PR with all changes -- never split a contract change from its implementation

## Contract Violations

A PR that violates a module's contract MUST be rejected. No exceptions. No "we'll fix it in the next PR." No "it's a minor deviation."

If the contract is wrong, change the contract first through the proper process. Then change the code. The ordering matters because it forces you to think about whether you are genuinely improving the architecture or just taking a shortcut.

Common violations:
- Adding a side effect not declared in the contract
- Importing a dependency not listed in the contract
- Bypassing a boundary rule (e.g., making a direct HTTP call when the contract says "use the http helper")
- Missing contract header in a new file
- Modifying a module's public interface without updating its contract

## Practical Benefits

**For agents**: No guessing about intent. The contract tells you exactly what a module should and should not do. You spend zero tokens figuring out "what was the original developer thinking?"

**For reviewers**: Contract compliance is binary. Either the code matches the contract or it doesn't. Review becomes verification, not archaeology.

**For humans**: You set the architectural rules via contracts. Agents follow them. You review contract changes, not implementation details. This is how a small team scales to a large codebase.

**For the codebase**: Contracts prevent the slow drift that kills projects. Every module stays within its declared boundaries, even as dozens of agents modify it over months.
