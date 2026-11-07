#!/usr/bin/env bash
# Tests for .githooks/pre-push — the REAL hook, not a copy of its logic.
#
# The two commands it runs are injectable (`ZONNA_TSC_CMD`, `ZONNA_TEST_CMD`) for the same reason
# `verify-cap-config.mjs` takes `CAP_CONFIG_PATH`: otherwise every case here costs three minutes and
# the suite that proves the guard becomes the reason nobody runs it.
#
# ⚠️ Case 6 exists because "an allow-by-default arm is not a check" — a hook that silently never
# invokes its runner passes every other case in this file.

set -uo pipefail
HOOK="$(cd "$(dirname "$0")" && pwd)/pre-push"
pass=0; fail=0
SENTINEL="$(mktemp -u)"

run() { # run <desc> <expected-exit> <env...>
  local desc="$1" want="$2"; shift 2
  local out; out=$(env "$@" bash "$HOOK" 2>&1); local got=$?
  if [ "$got" = "$want" ]; then pass=$((pass+1)); printf '  ok   %s\n' "$desc"
  else fail=$((fail+1)); printf '  FAIL %s (exit %s, wanted %s)\n%s\n' "$desc" "$got" "$want" "$out"; fi
  LAST_OUT="$out"
}

echo "pre-push hook — 7 cases"

# 1. tsc fails -> blocked
run "tsc red blocks the push" 1 ZONNA_TSC_CMD="echo 'foo.ts(1,1): error TS2322: nope'" ZONNA_TEST_CMD="true"
case "$LAST_OUT" in *"TypeScript errors detected"*) ;; *) echo "  FAIL case 1 did not name tsc"; fail=$((fail+1));; esac

# 2. tsc red must SHORT-CIRCUIT: the suite never runs
rm -f "$SENTINEL"
run "tsc red does not spend three minutes on the suite" 1 ZONNA_TSC_CMD="echo 'a.ts(1,1): error TS1 x'" ZONNA_TEST_CMD="touch $SENTINEL"
if [ -e "$SENTINEL" ]; then echo "  FAIL the suite ran after tsc had already failed"; fail=$((fail+1)); else pass=$((pass+1)); echo "  ok   the suite was not reached"; fi

# 3. suite red -> blocked
run "a red suite blocks the push" 1 ZONNA_TSC_CMD="true" ZONNA_TEST_CMD="false"
case "$LAST_OUT" in *"THE TEST SUITE IS RED"*) ;; *) echo "  FAIL case 3 did not name the suite"; fail=$((fail+1));; esac

# 4. both green -> allowed
run "both green allows the push" 0 ZONNA_TSC_CMD="true" ZONNA_TEST_CMD="true"

# 5. the override skips the SUITE and says so, loudly
run "ZONNA_SKIP_SUITE=1 allows a red suite" 0 ZONNA_SKIP_SUITE=1 ZONNA_TSC_CMD="true" ZONNA_TEST_CMD="false"
case "$LAST_OUT" in *"FULL SUITE SKIPPED"*) ;; *) echo "  FAIL the override was silent"; fail=$((fail+1));; esac

# 6. the override must NOT skip tsc — a hatch that disables everything is `--no-verify`, which exists
run "ZONNA_SKIP_SUITE=1 still blocks on tsc" 1 ZONNA_SKIP_SUITE=1 ZONNA_TSC_CMD="echo 'a.ts(1,1): error TS1 x'" ZONNA_TEST_CMD="true"

# 7. the runner is ACTUALLY INVOKED on the happy path
rm -f "$SENTINEL"
run "the suite really runs when both are green" 0 ZONNA_TSC_CMD="true" ZONNA_TEST_CMD="touch $SENTINEL"
if [ -e "$SENTINEL" ]; then pass=$((pass+1)); echo "  ok   the runner was invoked"; else echo "  FAIL the hook never invoked the suite"; fail=$((fail+1)); fi
rm -f "$SENTINEL"

echo ""
echo "  $pass passed, $fail failed"
[ "$fail" = 0 ] || exit 1
