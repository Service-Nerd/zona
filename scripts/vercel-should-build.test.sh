#!/usr/bin/env bash
# Falsification for scripts/vercel-should-build.sh — both directions, against
# REAL commits from this repo's history, not synthetic fixtures.
#
# A build filter that only ever says BUILD is indistinguishable from no filter
# and saves nothing. A build filter that wrongly says SKIP ships nothing and
# LOOKS EXACTLY LIKE A SUCCESSFUL DEPLOY. Both failures are silent, so both
# directions are asserted here.

set -uo pipefail
cd "$(dirname "$0")/.."
F=scripts/vercel-should-build.sh
pass=0; fail=0

# want: skip | build
check() {
  local want=$1 base=$2 head=$3 env=${4:-production} label=$5
  local out rc
  out=$(VERCEL_ENV="$env" BUILD_FILTER_BASE="$base" BUILD_FILTER_HEAD="$head" bash "$F" 2>&1); rc=$?
  local got=build; [ $rc -eq 0 ] && got=skip
  if [ "$got" = "$want" ]; then
    pass=$((pass+1)); printf '  ok    %-52s %s\n' "$label" "$out"
  else
    fail=$((fail+1)); printf '  FAIL  %-52s want=%s got=%s  %s\n' "$label" "$want" "$got" "$out"
  fi
}

echo "vercel-should-build:"
# A preview is a person waiting to look at something. Never skip one.
check build c4479db~1 c4479db preview "preview deploy of a docs-only commit"
# Docs-only, both shapes this repo actually produces.
check skip  c4479db~1 c4479db production "docs: state blocks name (docs/ only)"
# Code. Must build.
check build b250057~1 b250057 production "feat(W-01b): nav change (components/)"
# Unreachable refs fall through to BUILD, never to SKIP.
check build 0000000000000000000000000000000000000000 HEAD production "unreachable base"
check build HEAD       0000000000000000000000000000000000000000 production "unreachable head"
# A commit touching docs AND code must BUILD: the code half is deployable, and
# an "it is mostly docs" filter that skipped these would be the dangerous one.
# b250057 changed components/ AND docs/ in one commit.
check build b250057~1 b250057 production "docs+code in one commit builds"

# ⚠️ EVERY REF HERE IS A PINNED SHA, DELIBERATELY. The first cut found the
# docs+code case with `git log --since=midnight`, which would have quietly
# stopped testing anything from tomorrow onward. That is precisely
# FIXTURE-CLOCK-SWEEP-01, found in this repo the same morning: a check that
# ages out of reaching its subject still passes, and reads as coverage.

echo "  $pass passed, $fail failed"
[ $fail -eq 0 ]
