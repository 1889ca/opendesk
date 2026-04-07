#!/usr/bin/env bash
# review.sh -- Adversarial code review pipeline
#
# Runs parallel sub-agent reviewers against the codebase (or a diff),
# aggregates findings into a severity-ranked report, and optionally
# creates GitHub issues for critical/high findings.
#
# Usage:
#   ./scripts/review.sh                         # Review full codebase
#   ./scripts/review.sh --since <ref>           # Review changes since ref
#   ./scripts/review.sh --module auth           # Review a single module
#   ./scripts/review.sh --create-issues         # Auto-create GH issues for critical/high
#   ./scripts/review.sh --since HEAD~8 --create-issues

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
REVIEWS_DIR="$ROOT/reviews"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SINCE_REF=""
TARGET_MODULE=""
CREATE_ISSUES=false

while [ $# -gt 0 ]; do
  case "$1" in
    --since)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Usage: $0 --since <git-ref>"; exit 1
      fi
      SINCE_REF="$2"; shift 2 ;;
    --module)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Usage: $0 --module <module-name>"; exit 1
      fi
      TARGET_MODULE="$2"; shift 2 ;;
    --create-issues) CREATE_ISSUES=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$REVIEWS_DIR"

REVIEW_FILE="$REVIEWS_DIR/${TIMESTAMP}-review.md"

echo "# Code Review — $(date +%Y-%m-%d)" > "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"
echo "**Scope:** ${TARGET_MODULE:-all modules} ${SINCE_REF:+(changes since $SINCE_REF)}" >> "$REVIEW_FILE"
echo "**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$REVIEW_FILE"
echo "" >> "$REVIEW_FILE"

# --- Gather context ---

if [ -n "$SINCE_REF" ]; then
  CHANGED_FILES=$(git diff --name-only "$SINCE_REF" -- 'modules/' 2>/dev/null || echo "")
  DIFF_STAT=$(git diff --stat "$SINCE_REF" -- 'modules/' 2>/dev/null || echo "")
else
  CHANGED_FILES=$(find "$ROOT/modules/" -type f -name '*.ts' | sed "s|$ROOT/||")
  DIFF_STAT="(full codebase review)"
fi

if [ -n "$TARGET_MODULE" ]; then
  CHANGED_FILES=$(echo "$CHANGED_FILES" | grep "modules/$TARGET_MODULE/" || echo "")
fi

echo "Files in scope: $(echo "$CHANGED_FILES" | grep -c '.' || echo 0)"
echo "---"

# Write scope to report
{
  echo "## Scope"
  echo '```'
  echo "$DIFF_STAT"
  echo '```'
  echo ""
} >> "$REVIEW_FILE"

# --- Run the review ---
# This script is designed to be invoked by Claude Code, which will:
# 1. Read this report file path from stdout
# 2. Spawn parallel sub-agents for each review pass
# 3. Append findings to the report file
# 4. Optionally create GH issues

echo "REVIEW_FILE=$REVIEW_FILE"
echo "CHANGED_FILES_START"
echo "$CHANGED_FILES"
echo "CHANGED_FILES_END"
echo "CREATE_ISSUES=$CREATE_ISSUES"
