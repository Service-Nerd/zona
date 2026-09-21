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
# not a test hook bolted on: `git diff --quiet HEAD^ HEAD` silently compares the
# wrong pair if HEAD^ is unreachable, which is the shallow-clone case, and a
# filter whose two directions were never both demonstrated is exactly the
# "green tick with nothing behind it" this repo keeps recording.
BASE="${BUILD_FILTER_BASE:-HEAD^}"
HEADREF="${BUILD_FILTER_HEAD:-HEAD}"

git rev-parse --verify "$BASE^{commit}"    >/dev/null 2>&1 || build "base '$BASE' not reachable (shallow clone or first build)"
git rev-parse --verify "$HEADREF^{commit}" >/dev/null 2>&1 || build "head '$HEADREF' not reachable"

# Anything outside these paths is deployable and must build.
if git diff --quiet "$BASE" "$HEADREF" -- \
      ':(exclude)docs/**' \
      ':(exclude).claude/**' \
      ':(exclude)README.md' 2>/dev/null; then
  skip "only docs/, .claude/ or README changed"
fi

# `git diff --quiet` exits 1 when there ARE differences, and >1 on error.
# The `if` above cannot tell those apart, so an error lands here and builds.
build "deployable files changed, or git could not tell"
