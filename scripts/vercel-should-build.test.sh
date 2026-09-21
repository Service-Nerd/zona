#!/usr/bin/env bash
# Falsification for scripts/vercel-should-build.sh — both directions.
#
# A build filter that only ever says BUILD is indistinguishable from no filter
# and saves nothing. A build filter that wrongly says SKIP ships nothing and
# LOOKS EXACTLY LIKE A SUCCESSFUL DEPLOY. Both failures are silent, so both
# directions are asserted here.
#
# ⚠️ EVERY CASE RUNS AGAINST A SYNTHETIC REPO BUILT IN A TEMP DIR, and the
# reason is a real CI failure, not tidiness.
#
# The first version pinned real SHAs from this repo's history. That fixed the
# problem it was written for (a `--since=midnight` search would have aged out
# of reaching anything) and introduced a worse one: `actions/checkout@v4`
# defaults to `fetch-depth: 1`, so CI has ONE commit and none of those SHAs
# exist. Reproduced locally with `git clone --depth 1`:
#
#     6 passed, 3 failed
#
# and the three failures were the least of it. FOUR of the six "passes" were
# VACUOUS — they read `ok` because the base ref was unreachable so the filter
# fell through to BUILD, which is what those cases expected anyway. They never
# examined a diff. A suite that is 3 red and 4 hollow is worse than one that is
# simply red, because the green half invites you to trust it.
#
# A synthetic repo cannot age out, cannot be shallow, and cannot depend on this
# project's history being rewritten. It also lets the cases be exhaustive
# rather than "whatever happened to be in the log".

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/scripts/vercel-should-build.sh"
pass=0; fail=0; ran=0

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
git init -q .
git config user.email t@t.t; git config user.name t
git config commit.gpgsign false
printf '{\n  "scripts": { "build": "next build" }\n}\n' > package.json
mkdir -p docs .claude scripts app lib
echo a > docs/a.md; echo a > .claude/a.json; echo a > scripts/a.sh
echo a > README.md; echo a > app/a.tsx; echo a > lib/a.ts
git add -A && git commit -qm base
BASE_COMMIT=$(git rev-parse HEAD)

# Each case commits a change on top of BASE_COMMIT, then resets back, so the
# cases are independent of each other's order.
commit_and_check() { # want, label, then files to touch
  local want=$1 label=$2; shift 2
  git reset -q --hard "$BASE_COMMIT"
  for f in "$@"; do echo "$RANDOM" >> "$f"; done
  git add -A && git commit -qm "$label"
  local out rc
  out=$(VERCEL_ENV=production BUILD_FILTER_BASE="$BASE_COMMIT" BUILD_FILTER_HEAD=HEAD bash "$F" 2>&1); rc=$?
  local got=build; [ $rc -eq 0 ] && got=skip
  ran=$((ran+1))
  if [ "$got" = "$want" ]; then pass=$((pass+1)); printf '  ok    %-46s %s\n' "$label" "$out"
  else fail=$((fail+1)); printf '  FAIL  %-46s want=%s got=%s  %s\n' "$label" "$want" "$got" "$out"; fi
}

raw_check() { # want, label, env, base, head
  local want=$1 label=$2 env=$3 base=$4 head=$5
  local out rc
  out=$(VERCEL_ENV="$env" BUILD_FILTER_BASE="$base" BUILD_FILTER_HEAD="$head" bash "$F" 2>&1); rc=$?
  local got=build; [ $rc -eq 0 ] && got=skip
  ran=$((ran+1))
  if [ "$got" = "$want" ]; then pass=$((pass+1)); printf '  ok    %-46s %s\n' "$label" "$out"
  else fail=$((fail+1)); printf '  FAIL  %-46s want=%s got=%s  %s\n' "$label" "$want" "$got" "$out"; fi
}

echo "vercel-should-build:"

# ── SKIP: nothing a visitor can see ───────────────────────────────────────
commit_and_check skip  "docs/ only"                       docs/a.md
commit_and_check skip  ".claude/ only"                    .claude/a.json
commit_and_check skip  "scripts/ only"                    scripts/a.sh
commit_and_check skip  "README only"                      README.md
commit_and_check skip  "docs + .claude + scripts + README" docs/a.md .claude/a.json scripts/a.sh README.md

# ── BUILD: anything the site is made of ───────────────────────────────────
commit_and_check build "app/ changed"                     app/a.tsx
commit_and_check build "lib/ changed"                     lib/a.ts
commit_and_check build "a NEW top-level file"             package.json
# The dangerous one: mostly-docs with a single deployable file hidden in it.
commit_and_check build "docs + one app/ file"             docs/a.md app/a.tsx

# ── The guard: scripts/ stops being excluded if the build reads it ────────
git reset -q --hard "$BASE_COMMIT"
printf '{\n  "scripts": { "prebuild": "node scripts/gen.mjs", "build": "next build" }\n}\n' > package.json
echo x >> scripts/a.sh
git add -A && git commit -qm "build reads scripts/"
raw_check build "scripts/ only, but the build READS scripts/" production "$BASE_COMMIT" HEAD
git reset -q --hard "$BASE_COMMIT"

# ── Fail-safe: every uncertain case BUILDS, never skips ───────────────────
raw_check build "a preview deploy is never skipped"  preview    "$BASE_COMMIT" HEAD
raw_check build "VERCEL_ENV unset"                   ""         "$BASE_COMMIT" HEAD
raw_check build "unreachable base"                   production 0000000000000000000000000000000000000000 HEAD
raw_check build "unreachable head"                   production "$BASE_COMMIT" 0000000000000000000000000000000000000000

# ── 🔴 THE DEFAULT BASE — the case this suite could not fail on ──────────
#
# Every case above passes BUILD_FILTER_BASE explicitly, so all fourteen tested
# the COMPARISON and none tested the CHOICE OF WHAT TO COMPARE. The default was
# `HEAD^`, and on 2026-09-21 an eleven-commit branch was fast-forwarded onto
# main: Vercel diffed only the last commit, that commit was docs-only, and the
# filter SKIPPED the production deploy of a whole day's work. Push succeeded,
# CI green, nothing failed, site unchanged.
#
# These cases run with BUILD_FILTER_BASE UNSET, which is the only way to reach
# the line that was wrong.
default_check() { # want, label, previous_sha
  local want=$1 label=$2 prev=$3
  local out rc
  out=$(VERCEL_ENV=production VERCEL_GIT_PREVIOUS_SHA="$prev" BUILD_FILTER_HEAD=HEAD bash "$F" 2>&1); rc=$?
  local got=build; [ $rc -eq 0 ] && got=skip
  ran=$((ran+1))
  if [ "$got" = "$want" ]; then pass=$((pass+1)); printf '  ok    %-46s %s\n' "$label" "$out"
  else fail=$((fail+1)); printf '  FAIL  %-46s want=%s got=%s  %s\n' "$label" "$want" "$got" "$out"; fi
}

# THE REGRESSION ITSELF: several commits since the last deploy, the last of
# them docs-only. `HEAD^` says skip. The truth is build.
git reset -q --hard "$BASE_COMMIT"
echo x >> app/a.tsx;  git add -A && git commit -qm "code"
echo x >> lib/a.ts;   git add -A && git commit -qm "more code"
echo x >> docs/a.md;  git add -A && git commit -qm "docs naming the ship"
default_check build "multi-commit push, LAST commit docs-only" "$BASE_COMMIT"
# ...and prove HEAD^ really would have got it wrong, so the case is not vacuous.
raw_check      skip  "  (HEAD^ on that same push says SKIP)"   production HEAD^ HEAD

# The filter must still EARN its place: a single docs commit since the last
# deployment is exactly what it exists to skip.
git reset -q --hard "$BASE_COMMIT"
echo x >> docs/a.md; git add -A && git commit -qm "docs only"
default_check skip  "single docs commit since last deploy"     "$BASE_COMMIT"

# Fail-safe on the new default: no previous SHA, or one we cannot see.
default_check build "VERCEL_GIT_PREVIOUS_SHA unset"            ""
default_check build "VERCEL_GIT_PREVIOUS_SHA unreachable"      0000000000000000000000000000000000000000
git reset -q --hard "$BASE_COMMIT"

# ⚠️ A suite that silently stops reaching its cases reads as a clean run. The
# CI failure this file exists for had FOUR hollow passes; this is the guard
# against that recurring.
echo "  $pass passed, $fail failed ($ran cases ran)"
[ "$ran" -eq 19 ] || { echo "  FAIL: expected 19 cases to run, got $ran"; exit 1; }
[ "$fail" -eq 0 ]
