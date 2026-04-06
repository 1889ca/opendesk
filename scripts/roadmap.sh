#!/usr/bin/env bash
# roadmap.sh -- Run a hivemind roadmap revision to prioritize next steps
#
# Usage:
#   ./scripts/roadmap.sh

set -euo pipefail

HIVEMIND_PATH="${HIVEMIND_PATH:-$HOME/projects/hivemind/src/index.js}"
ROOT="$(git rev-parse --show-toplevel)"
DECISIONS_DIR="$ROOT/decisions"
DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="$DECISIONS_DIR/${DATE}-roadmap-revision.md"

mkdir -p "$DECISIONS_DIR"

# --- Gather project state ---

echo "Gathering project state for roadmap revision..."

# Read MVP doc
MVP_CONTENT=""
if [ -f "$ROOT/docs/mvp.md" ]; then
  MVP_CONTENT=$(cat "$ROOT/docs/mvp.md")
else
  echo "Warning: docs/mvp.md not found"
  MVP_CONTENT="(MVP document not found)"
fi

# Read latest decision summaries (filenames + first lines)
DECISION_SUMMARIES=""
if [ -d "$DECISIONS_DIR" ]; then
  for f in "$DECISIONS_DIR"/*.md; do
    [ -f "$f" ] || continue
    BASENAME=$(basename "$f")
    FIRST_LINE=$(head -1 "$f" 2>/dev/null || echo "")
    DECISION_SUMMARIES="${DECISION_SUMMARIES}  ${BASENAME}: ${FIRST_LINE}\n"
  done
fi

if [ -z "$DECISION_SUMMARIES" ]; then
  DECISION_SUMMARIES="(no decisions recorded yet)"
fi

# Read open GitHub issues
GITHUB_ISSUES=$(gh issue list --limit 20 2>/dev/null || echo "(gh CLI unavailable or no issues)")

# Read recent git log
RECENT_LOG=$(git -C "$ROOT" log --oneline -20 2>/dev/null || echo "(no git history)")

# --- Compose the prompt ---

TOPIC="OpenDesk roadmap revision -- prioritize next steps for the MVP"

CONTEXT="Current project state as of ${DATE}.

MVP DOCUMENT:
${MVP_CONTENT}

RECENT DECISIONS:
$(echo -e "$DECISION_SUMMARIES")

OPEN GITHUB ISSUES:
${GITHUB_ISSUES}

RECENT GIT LOG (last 20 commits):
${RECENT_LOG}

TECH STACK: TipTap + Yjs (CRDT), Express, PostgreSQL, Zod, TypeScript.
LICENSE: AGPL-3.0. Sovereign, self-hostable office suite."

PROMPT="Given the current state of the OpenDesk project, answer these questions:

1. PRIORITIES: What should be prioritized next given current progress? Consider what is already built vs what remains.

2. ARCHITECTURE REVIEW: Are there any architectural decisions that need revisiting? Look at the decisions log for anything that may need updating based on new information or implementation experience.

3. HIGHEST RISK: What is the highest-risk item that could block the MVP? Consider technical risks, dependency risks, and scope risks.

4. BEST VALUE: What would deliver the most user value with the least effort? Identify quick wins that would make the product more usable.

5. RECOMMENDATIONS: Provide a prioritized list of the top 5-7 next actions, each with estimated effort (small/medium/large) and impact (low/medium/high/critical).

${CONTEXT}"

echo "Running roadmap revision..."
echo "---"

node "$HIVEMIND_PATH" "$TOPIC" \
  --mode research \
  --context "$PROMPT" \
  --output "$OUTPUT_FILE"

echo ""
echo "Roadmap revision saved to: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the revision and discuss with the team"
echo "  2. Update docs/mvp.md if priorities have shifted"
echo "  3. Create or update GitHub issues for new action items"
