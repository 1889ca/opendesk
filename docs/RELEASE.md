# Release runbook: dev → main

## Why this document exists

On 2026-04-09 the dev → main release pipeline broke because of a divergence between the two long-lived branches that git could not automatically reconcile. The root cause was a **squash merge** of dev → main (`0d4bf37`) that left the source branch (`dev`) with the original 260 individual commits while the target branch (`main`) had the same content as a single squash commit with a brand-new SHA. Subsequent work on dev appeared to git as 260 + N "new" commits to merge, even though 260 of them were already conceptually present in main's squash. The result was a PR that conflicted on essentially every file.

This runbook codifies the rules and provides an automated script (`scripts/release.sh`) so the same trap can't be fallen into again.

## The rule

> **Never squash-merge `dev` into `main`. Use a merge commit (or fast-forward).**

Squash merging is fine — even preferred — for short-lived feature branches into `dev`, because the feature branch dies after the merge. It is **catastrophic** for the long-lived dev/main pair because both branches keep living after the merge and divergence accumulates silently until the next attempted release.

### Why merge commits work

A merge commit has two parents. Git uses both parent SHAs as the merge base when computing future merges, so it correctly knows that "everything up to dev's tip at the time of the merge is now on main." Future commits to dev are merged incrementally, not re-applied from scratch.

A squash commit has one parent. Git has no record that the squash content came from dev. When dev advances, git tries to merge dev's full history (including the commits that were already squashed) and conflicts everywhere.

### Why fast-forward also works

If `dev` is strictly ahead of `main` with no diverging commits, a fast-forward merge just moves `main`'s pointer to dev's tip. The original commit SHAs are preserved. Future merges work correctly because the histories are still aligned.

## Standard release procedure

Use the script:

```bash
./scripts/release.sh
```

The script enforces every safety check below and refuses to proceed if any of them fails. **Always use it instead of running git commands by hand for releases.**

The script does:

1. Verify the working tree is clean (no uncommitted changes)
2. Verify you are on `dev`
3. Sync `git fetch origin dev main`
4. Verify `dev` matches `origin/dev` (no unpushed commits)
5. Check that `dev` is actually ahead of `main` (`git rev-list --count main..dev > 0`)
6. Verify `main` is not ahead of `dev` in any way that would cause a conflict (i.e. no parallel commits on `main` that aren't on `dev`)
7. Run `npm run check`, `lint`, `test`, `build:frontend` locally one final time
8. Create a release branch `release/YYYY-MM-DD-<short-sha>` from `origin/main`
9. Merge `origin/dev` into the release branch with `git merge --no-ff` (forcing a merge commit even when fast-forward would be possible — this makes release boundaries grep-able in `git log --first-parent main`)
10. Push the release branch
11. Open a PR via `gh pr create --base main`

The PR uses the **"Create a merge commit"** GitHub merge button (not "Squash and merge", not "Rebase and merge"). The runbook in the PR body reminds the reviewer.

## What about hotfixes to main?

If a critical fix lands directly on `main` (skipping dev), you must immediately back-merge `main` into `dev` so dev catches up. The flow is:

```bash
git checkout dev
git pull origin dev
git merge --no-ff origin/main -m "Sync main → dev (hotfix backport)"
git push origin dev
```

This preserves the dev/main alignment that the merge-commit rule depends on. **Never rebase dev onto main** for this — rebasing rewrites SHAs and creates the same divergence the squash rule prevents.

## Forbidden operations

These will break the alignment and require manual recovery (see "Recovery" below):

- **`git merge --squash dev` from main** — collapses dev's history, breaks alignment
- **GitHub "Squash and merge" button** on a dev → main PR — same as above
- **`git rebase dev` from main** — rewrites SHAs, breaks alignment
- **`git push --force` on either dev or main** — bypasses any safety the alignment provides

If you absolutely must do one of these (e.g., to recover from a previous mistake), follow the recovery procedure.

## Recovery: dev and main are diverged

If dev and main have diverged because of a previous squash or force-push, you have two options:

### Option A: Reset dev to match main (preserves main, loses dev's individual commit history)

```bash
git checkout dev
git fetch origin main
git reset --hard origin/main
git push --force-with-lease origin dev
```

Then re-apply any new dev work (e.g., feature branches that hadn't been released) on top by cherry-picking or by re-creating the feature branches from the new dev tip.

### Option B: Cherry-pick just the new work onto main (preserves dev, leaves main with the squash)

```bash
git fetch origin main
git checkout -b feat/<thing>-on-main origin/main
git cherry-pick <sha-of-the-new-work>
git push -u origin feat/<thing>-on-main
gh pr create --base main --head feat/<thing>-on-main
```

This is what we did to land #189 / #191 after the 2026-04-09 incident.

After either option, future releases must use `scripts/release.sh` so the divergence does not recur.

## GitHub repo settings (one-time configuration)

To make the rule enforceable at the platform level, **disable squash merging on the repo** (or, if other PRs need it, configure a branch ruleset that disables squash merging only for PRs targeting `main`):

```bash
gh api -X PATCH "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)" \
  -F allow_squash_merge=false \
  -F allow_merge_commit=true \
  -F allow_rebase_merge=false
```

After running this, the GitHub UI will only show "Create a merge commit" as a merge option and the bug class is gone for good. Confirm with:

```bash
gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)" \
  --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge}'
```

If you need squash merges for `feat/* → dev` PRs (the recommended workflow for short-lived feature branches), keep squash merging enabled repo-wide and instead set up a **branch ruleset** on `main` that requires "merge commit" as the only allowed merge method. See: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository

## CI guard (optional, recommended)

`.github/workflows/ci.yml` could include a job that runs on every PR targeting `main` and checks for divergence:

```yaml
detect-divergence:
  if: github.base_ref == 'main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }
    - name: Detect dev/main divergence
      run: |
        git fetch origin main
        # If main contains a commit whose squashed content matches a range
        # of commits on the PR head, fail.
        ./scripts/check-no-squash-divergence.sh origin/main HEAD
```

This is a nice-to-have. The script + runbook + repo setting are sufficient on their own.
