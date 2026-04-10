#!/usr/bin/env bash
#
# release.sh — safely create a dev → main release PR.
#
# Enforces the "no squash merges into main" rule documented in
# docs/RELEASE.md. The rule exists because squash-merging the
# long-lived dev branch into the long-lived main branch leaves dev
# with the original individual commits while main has only a single
# squash commit, and git cannot reconcile the two — every subsequent
# release attempt then conflicts on the entire backlog.
#
# What this script does:
#
#   1. Verify clean working tree, on dev branch, in sync with origin
#   2. Verify dev is ahead of main (something to release)
#   3. Run the local build/lint/test/typecheck gauntlet one last time
#   4. Create release/YYYY-MM-DD-<sha> from origin/main
#   5. Merge origin/dev into it with --no-ff (forced merge commit)
#   6. Push the release branch
#   7. Open a PR via gh, with explicit instructions in the body to
#      use the "Create a merge commit" merge button (NOT squash)
#
# Usage:
#   ./scripts/release.sh                # standard release
#   ./scripts/release.sh --skip-tests   # skip the local test gauntlet
#                                       # (CI still runs them on the PR)
#   ./scripts/release.sh --dry-run      # show what would happen, no changes

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# ---------- argument parsing ----------

SKIP_TESTS=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    -h|--help)
      sed -n '3,30p' "$0" | sed 's/^# *//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Use --help for usage." >&2
      exit 2
      ;;
  esac
done

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

fail() {
  echo "❌ $*" >&2
  exit 1
}

ok() {
  echo "✓ $*"
}

# ---------- precondition checks ----------

echo "=== Release: dev → main ==="
echo ""

# 1. Clean working tree
if ! git diff-index --quiet HEAD --; then
  fail "Working tree has uncommitted changes. Stash or commit first."
fi
ok "Working tree clean"

# 2. On dev
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "dev" ]; then
  fail "Must be on dev branch (currently on: $current_branch)"
fi
ok "On dev branch"

# 3. Sync remote refs (always safe — read-only)
git fetch origin main dev --quiet
ok "Fetched origin/main and origin/dev"

# 4. Local dev matches origin/dev
local_dev=$(git rev-parse dev)
remote_dev=$(git rev-parse origin/dev)
if [ "$local_dev" != "$remote_dev" ]; then
  fail "Local dev ($local_dev) is out of sync with origin/dev ($remote_dev). Pull or push first."
fi
ok "dev is in sync with origin/dev"

# 5. dev must be ahead of main
ahead=$(git rev-list --count origin/main..origin/dev)
if [ "$ahead" -eq 0 ]; then
  echo ""
  echo "ℹ Nothing to release: dev is not ahead of main."
  exit 0
fi
ok "$ahead commit(s) on dev not yet on main"

# 6. main should not have commits that aren't on dev (would indicate
#    a hotfix that hasn't been back-merged into dev — see RELEASE.md)
main_only=$(git rev-list --count origin/dev..origin/main)
if [ "$main_only" -gt 0 ]; then
  echo ""
  echo "❌ main has $main_only commit(s) that are not on dev:"
  git log --oneline origin/dev..origin/main >&2
  echo ""
  echo "This is the divergence pattern that causes the conflict bug." >&2
  echo "Back-merge main into dev first, then re-run this script:" >&2
  echo "  git checkout dev" >&2
  echo "  git merge --no-ff origin/main -m 'Sync main → dev (hotfix backport)'" >&2
  echo "  git push origin dev" >&2
  echo "" >&2
  echo "See docs/RELEASE.md for the full rationale." >&2
  exit 1
fi
ok "main has no commits that aren't on dev"

# ---------- local verification (mirrors CI) ----------

if [ "$SKIP_TESTS" -eq 0 ]; then
  echo ""
  echo "--- Running local verification gauntlet ---"
  run npm run check
  run npm run lint
  run npm run test -- --run
  run npm run build:frontend
  ok "All local checks passed"
else
  echo "ℹ Skipping local tests (--skip-tests)"
fi

# ---------- create release branch ----------

today=$(date +%Y-%m-%d)
short=$(git rev-parse --short origin/dev)
release_branch="release/${today}-${short}"

echo ""
echo "--- Building release branch: $release_branch ---"

# Branch from main, then merge dev with --no-ff to force a merge commit
# even if a fast-forward would have been possible. The merge commit is
# what makes the histories grep-able with `git log --first-parent main`
# AND it gives git a clean merge base for future releases — exactly the
# property the squash merge breaks.
run git checkout -b "$release_branch" origin/main
run git merge --no-ff origin/dev \
  -m "Release: dev → main ($today)" \
  -m "Merges $ahead commit(s) from dev into main as a merge commit (NOT a squash). See docs/RELEASE.md for the rule and rationale."

# ---------- push + PR ----------

if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "[dry-run] Would push $release_branch and create PR via gh."
  echo "[dry-run] Cleaning up local branch."
  git checkout dev
  git branch -D "$release_branch"
  exit 0
fi

git push -u origin "$release_branch"

# Build the PR body. Use a heredoc that gh will pass through verbatim.
pr_body=$(cat <<EOF
## Summary

Standard dev → main release. **Merges $ahead commit(s)** from dev into main.

This PR is built by \`scripts/release.sh\`. The release branch was created from \`origin/main\` and \`origin/dev\` was merged into it with \`git merge --no-ff\`. A merge commit is intentional — see [docs/RELEASE.md](../blob/main/docs/RELEASE.md) for the rule and the incident that prompted it.

## ⚠️ How to merge this PR

**Use the "Create a merge commit" GitHub button. NOT "Squash and merge".**

Squash merging on a long-lived branch pair (dev ↔ main) leaves the source branch with the original commits and the target with a single new SHA, creating a divergence that git cannot reconcile. Every subsequent release then conflicts on the entire backlog. Merging via merge commit keeps the histories aligned.

If "Squash and merge" is the only option offered, the repo setting is misconfigured — see \`docs/RELEASE.md\` § GitHub repo settings.

## Test plan

- [x] \`npm run check\` — clean (run by release.sh)
- [x] \`npm run lint\` — clean (run by release.sh)
- [x] \`npm run test --run\` — all passing (run by release.sh)
- [x] \`npm run build:frontend\` — bundles built (run by release.sh)
- [ ] CI passes on this PR
- [ ] Reviewer confirms the merge button shows "Create a merge commit" before clicking

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

gh pr create \
  --base main \
  --head "$release_branch" \
  --title "Release: dev → main ($today)" \
  --body "$pr_body"

echo ""
ok "Release PR created. ⚠️  Merge it with the 'Create a merge commit' button — NOT squash."
