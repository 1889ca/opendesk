#!/usr/bin/env bash
# deliberate.sh — Run a hivemind deliberation and save the audit log
#
# Usage:
#   ./scripts/deliberate.sh "<topic>" [--mode <mode>] [--context "<context>"] [--issue <number>]
#
# Examples:
#   ./scripts/deliberate.sh "Should we use Yjs or Automerge for CRDTs?"
#   ./scripts/deliberate.sh "Auth architecture" --mode research --context "Must support OIDC and self-hosted IdP"
#   ./scripts/deliberate.sh "Document format choice" --issue 42

set -euo pipefail

HIVEMIND_PATH="${HIVEMIND_PATH:-$HOME/projects/hivemind/src/index.js}"
DECISIONS_DIR="$(git rev-parse --show-toplevel)/decisions"

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"<topic>\" [--mode <mode>] [--context \"<context>\"] [--issue <number>]"
  exit 1
fi

TOPIC="$1"
shift

MODE="research"
CONTEXT=""
ISSUE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --context) CONTEXT="$2"; shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

DATE=$(date +%Y-%m-%d)
SLUG=$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-60)
DELIBERATION_FILE="$DECISIONS_DIR/${DATE}-${SLUG}-deliberation.md"
SUMMARY_FILE="$DECISIONS_DIR/${DATE}-${SLUG}.md"

mkdir -p "$DECISIONS_DIR"

# Build hivemind command
CMD="node $HIVEMIND_PATH \"$TOPIC\" --mode $MODE"
if [ -n "$CONTEXT" ]; then
  CMD="$CMD --context \"$CONTEXT\""
fi
CMD="$CMD --output \"$DELIBERATION_FILE\""

echo "Running hivemind deliberation..."
echo "  Topic: $TOPIC"
echo "  Mode: $MODE"
echo "  Output: $DELIBERATION_FILE"
echo ""

eval "$CMD"

# Generate summary template
ISSUE_LINE=""
if [ -n "$ISSUE" ]; then
  ISSUE_LINE="**Issue**: #${ISSUE}"
fi

cat > "$SUMMARY_FILE" << EOF
# Decision: ${TOPIC}

**Date**: ${DATE}
**Status**: Proposed
**Deliberation**: $(basename "$DELIBERATION_FILE")
${ISSUE_LINE}

## Context

<!-- What prompted this decision -->

## Decision

<!-- What was decided — fill in after reviewing the deliberation -->

## Consequences

<!-- What this means for the codebase -->

## Deliberation Summary

<!-- Key arguments for and against, extracted from the hivemind session -->
<!-- Review the full deliberation at: $(basename "$DELIBERATION_FILE") -->
EOF

echo ""
echo "Deliberation saved to: $DELIBERATION_FILE"
echo "Summary template saved to: $SUMMARY_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the full deliberation"
echo "  2. Fill in the summary template"
echo "  3. Commit both files"
