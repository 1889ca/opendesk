# Hivemind Integration

How OpenDesk uses multi-model deliberation for radical transparency in decision-making.

## What is Hivemind?

Hivemind is a multi-AI deliberation coordinator that orchestrates discussions between multiple AI models (Claude, Gemini, DeepSeek, Mistral). It supports several coordination modes:

- **Research** -- collaborative deep-dive into a topic
- **Round-robin** -- structured turn-taking discussion
- **Moderator** -- one model guides the discussion
- **Fib** -- adversarial reverse-engineering (claim testing)
- **Team** -- role-based discussion with custom personas

## Why Hivemind in OpenDesk?

Every significant decision in OpenDesk must have an audit trail. Not just "we decided X" but "here's the full deliberation, the arguments for and against, the models involved, and the conclusion."

This serves multiple purposes:

1. **Transparency** -- anyone can read why a decision was made
2. **Anti-monoculture** -- multiple models prevent single-model bias
3. **Reversibility** -- if a decision turns out wrong, the deliberation log shows what was considered
4. **Trust** -- users and contributors can verify that decisions are well-reasoned
5. **Learning** -- future agents can read past deliberations to understand context

## When to Use Hivemind

### Required

- Architectural decisions (new modules, structural changes, technology choices)
- Contract changes (modifying a module's behavioral contract)
- Constitutional amendments
- Security-sensitive changes
- Breaking changes to the API or document format

### Optional but encouraged

- Complex feature designs with multiple valid approaches
- Performance trade-off decisions
- UX decisions affecting the editor experience

### Not needed

- Bug fixes with obvious solutions
- Test additions
- Documentation updates
- Routine dependency updates

## The Deliberation Workflow

1. Agent or human identifies a decision that needs deliberation.
2. Create an issue tagged `decision-needed`.
3. Run Hivemind with the question, relevant context, and appropriate mode.
4. Hivemind produces a deliberation log (markdown with full transcript).
5. Log is committed to `decisions/YYYY-MM-DD-<slug>.md`.
6. Decision summary is added to the issue.
7. If the decision affects a contract, the contract is updated.
8. Implementation proceeds based on the decision.

## Decision Log Format

```markdown
# Decision: <Title>

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded by #<issue>
**Deliberation**: decisions/YYYY-MM-DD-<slug>-deliberation.md
**Issue**: #<number>

## Context
<What prompted this decision>

## Decision
<What was decided>

## Consequences
<What this means for the codebase>

## Deliberation Summary
<Key arguments for and against, from the hivemind session>
```

## Integration Details

Hivemind is invoked via CLI:

```bash
node ~/projects/hivemind/src/index.js "<question>" --mode research --context "<relevant context>"
```

For OpenDesk, we use a wrapper script at `scripts/deliberate.sh` that:

- Accepts a topic and context
- Runs Hivemind in research mode by default
- Automatically saves the output to `decisions/`
- Creates a summary for the linked issue

The full deliberation transcript (every model's response, every round) is committed as-is. Nothing is edited or summarized away.

## Reading Decision Logs

The `decisions/` directory is organized chronologically. Each decision has:

- A summary file (`YYYY-MM-DD-<slug>.md`) -- quick reference
- A full deliberation file (`YYYY-MM-DD-<slug>-deliberation.md`) -- complete transcript

Anyone can read these. They are part of the public repo. This is radical transparency.
