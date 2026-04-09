#!/usr/bin/env bash
#
# check-restricted-zones.sh -- Detect PR changes to constitutionally
# restricted zones (issue #128).
#
# Usage:
#   ./scripts/check-restricted-zones.sh <base-ref>
#
# Compares HEAD against <base-ref> and lists every touched path that
# matches a restricted zone. Exits 0 in all cases — the caller (CI
# workflow) decides what to do with the output.
#
# Output format: one matched path per line on stdout. Empty output
# means no restricted-zone touches.
#
# Restricted zones are defined in CONSTITUTION.md Article II §1 and
# mirrored in CLAUDE.md.

set -euo pipefail

BASE_REF="${1:-main}"

# Patterns are matched against `git diff --name-only` output.
# Each pattern is a POSIX extended regex anchored to the start of the path.
RESTRICTED_PATTERNS=(
  '^modules/auth/'
  '^modules/sharing/'
  '^modules/permissions/'
  '^migrations/'
  '^package\.json$'
  '^package-lock\.json$'
  '^LICENSE$'
  '^CONSTITUTION\.md$'
  '^CONTRIBUTING\.md$'
  '^CLAUDE\.md$'
  '^\.github/workflows/'
)

# Build a single OR-joined regex for grep.
JOINED_PATTERN="$(IFS='|'; echo "${RESTRICTED_PATTERNS[*]}")"

# Resolve base ref. For pull_request events, GITHUB_BASE_REF is the
# target branch (e.g. "dev" or "main") and we need origin/<ref>.
if git rev-parse --verify "origin/${BASE_REF}" >/dev/null 2>&1; then
  RESOLVED_BASE="origin/${BASE_REF}"
elif git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  RESOLVED_BASE="${BASE_REF}"
else
  echo "ERROR: Cannot resolve base ref '${BASE_REF}'" >&2
  exit 2
fi

git diff --name-only "${RESOLVED_BASE}...HEAD" \
  | grep -E "${JOINED_PATTERN}" \
  || true
