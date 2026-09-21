#!/usr/bin/env bash
# Vercel "Ignored Build Step" — skip a production build when the commit changed
# nothing a visitor can see.
#
# Exit 0 = SKIP the build. Exit 1 = BUILD.
#
# ⚠️ WHY THIS EXISTS. On 2026-09-21 this project hit Vercel's Hobby cap of 100
# deployments per day and stopped deploying for 24 hours, mid-session, with
# work already pushed. Counted afterwards: of 53 commits that day, THIRTY
# changed only `docs/` or `.claude/` and each one built and deployed a site
# that was byte-for-byte identical.
#
# ⚠️ AND IT IS NOT ONLY CARELESSNESS, WHICH IS WHY A SCRIPT AND NOT A HABIT.
# `audit-docs.sh` requires the state paragraphs in backlog.md, roadmap.md and
# MEMORY.md to name the LAST SHIP's SHA. That is unknowable until the ship is
# committed, so every feature commit is NECESSARILY followed by a docs-only
# commit naming it. The check that keeps the documentation honest is
# structurally generating half the deploys. A habit cannot fix that; a build
# filter can.
#
# 🔴 FAIL-SAFE DIRECTION IS *BUILD*. Every uncertain case — no previous commit,
# a shallow clone that cannot see HEAD^, git erroring at all — falls through to
# BUILD. A missed skip costs one deployment. A wrong skip ships nothing and
# looks exactly like success, which is the failure mode this repo has recorded
# more than any other.

set -uo pipefail

build()  { echo "BUILD: $1";  exit 1; }
skip()   { echo "SKIP: $1";   exit 0; }

# Only ever skip on production. A preview is somebody waiting to look at it.
[ "${VERCEL_ENV:-}" = "production" ] || build "not a production deploy (VERCEL_ENV=${VERCEL_ENV:-unset})"

# BASE..HEAD. Overridable so this script can be FALSIFIED against real commits
# without checking anything out — see scripts/vercel-should-build.test.sh. It is
# not a test hook bolted on: a filter whose two directions were never both
# demonstrated is exactly the "green tick with nothing behind it" this repo
# keeps recording.
#
# 🔴 THE BASE IS THE LAST DEPLOYED COMMIT, **NEVER `HEAD^`**, AND THIS COST A
# REAL SHIP. `HEAD^` was the default for the first nine hours of this script's
# life. On 2026-09-21 an eleven-commit branch was fast-forwarded onto main and
# pushed; Vercel evaluated `HEAD^..HEAD`, which is only the LAST commit, and
# that commit was docs-only. **The filter skipped the production deploy of a
# whole day's work**, and a skipped deploy looks exactly like a successful one:
# the push succeeded, CI was green, nothing failed, and the site simply did not
# change. The script's own header warned about this failure mode in those
# words. The mechanism it warned about was not the one that bit.
#
# `VERCEL_GIT_PREVIOUS_SHA` is the commit of the previous deployment, so the
# diff spans everything that has not shipped, however many commits that is.
# There is deliberately NO fallback to `HEAD^`: for a push of more than one
# commit `HEAD^` is not a conservative guess, it is the wrong question, and a
# wrong SKIP is unrecoverable-looking while a wrong BUILD costs one deploy.
BASE="${BUILD_FILTER_BASE:-${VERCEL_GIT_PREVIOUS_SHA:-}}"
HEADREF="${BUILD_FILTER_HEAD:-HEAD}"

[ -n "$BASE" ] || build "no previous-deployment SHA (VERCEL_GIT_PREVIOUS_SHA unset) — cannot tell what changed"

git rev-parse --verify "$BASE^{commit}"    >/dev/null 2>&1 || build "base '$BASE' not reachable (shallow clone or first build)"
git rev-parse --verify "$HEADREF^{commit}" >/dev/null 2>&1 || build "head '$HEADREF' not reachable"

# Anything outside these paths is deployable and must build.
# ⚠️ `scripts/` IS EXCLUDED, AND THIS GUARD IS WHY THAT IS SAFE.
# `npm run build` is a bare `next build`: nothing under scripts/ runs during a
# build, so a change there cannot alter the deployed site. Measured 2026-09-21
# after the first version shipped: two consecutive deploys were spent on
# `scripts/audit-docs.sh` edits, which is exactly the waste this filter exists
# to stop. The one file that DOES run in the build pipeline is this script
# itself, as the ignoreCommand, and it is read from the clone at HEAD every
# time, so it never needs a build to take effect.
#
# The guard: if the build command ever starts referencing scripts/, the
# exclusion becomes wrong silently, so it stops applying. Fail toward BUILD.
scripts_safe=1
if grep -qE '"(pre|post)?build"[^,]*scripts/' package.json 2>/dev/null; then
  scripts_safe=0
  echo "note: build command references scripts/ — not excluding it"
fi

if [ "$scripts_safe" = "1" ]; then
  if git diff --quiet "$BASE" "$HEADREF" -- \
        ':(exclude)docs/**' \
        ':(exclude).claude/**' \
        ':(exclude)scripts/**' \
        ':(exclude)README.md' 2>/dev/null; then
    skip "only docs/, .claude/, scripts/ or README changed"
  fi
elif git diff --quiet "$BASE" "$HEADREF" -- \
      ':(exclude)docs/**' \
      ':(exclude).claude/**' \
      ':(exclude)README.md' 2>/dev/null; then
  skip "only docs/, .claude/ or README changed"
fi

# `git diff --quiet` exits 1 when there ARE differences, and >1 on error.
# The `if` above cannot tell those apart, so an error lands here and builds.
build "deployable files changed, or git could not tell"
