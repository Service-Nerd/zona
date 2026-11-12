#!/usr/bin/env bash
# OPS-VERIFY-CI-IOS-SDK-01 — `typecheck-ios-swift.sh` guarded the wrong capability.
#
# 🔴 WHAT HAPPENED. The script skipped when `swiftc` was absent — "macOS only". GitHub's ubuntu
# runner HAS `swiftc`; what it lacks is the APPLE SDK, and `HealthKit` is an Apple framework. So
# the skip passed, the typecheck ran, and `no such module 'HealthKit'` failed every CI job. The
# script's own header states the assumption out loud — *"HealthKit and Security ARE in the macOS
# SDK that ships with Command Line Tools"* — and then guarded it by testing for a compiler.
#
# ⚠️ THIRD LOCAL/CI DIVERGENCE IN ONE DAY, and the third different mechanism: two gates reading
# `git ls-files` could not see an unstaged file; one reading the filesystem could not be read by
# CI; this one asked whether a tool existed instead of whether it could do the job.
#
# These cases run the REAL script with a stubbed `swiftc` on PATH, because the property is "what
# does it do on a machine without the SDK" and this machine has one.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SCRIPT="scripts/typecheck-ios-swift.sh"
pass=0; fail=0
ok()   { printf '  ✓ %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  ✗ %s\n     %s\n' "$1" "$2"; fail=$((fail+1)); }

echo "typecheck-ios-swift — the skip guards the SDK, not the compiler"

# ── 1. swiftc present, Apple SDK absent — the exact CI shape ────────────────
STUB="$(mktemp -d)"
cat > "$STUB/swiftc" <<'SH'
#!/usr/bin/env bash
# A Swift toolchain with no Apple SDK: it exists, and it cannot resolve HealthKit.
echo "error: no such module 'HealthKit'" >&2
exit 1
SH
chmod +x "$STUB/swiftc"
out=$(PATH="$STUB:$PATH" bash "$SCRIPT" 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "a toolchain without the Apple SDK SKIPS (exit 0), it does not fail the build" \
                || bad "a toolchain without the Apple SDK should skip" "exit $rc"
grep -q "Apple SDK is not" <<<"$out" \
  && ok "and says WHY — the SDK, not the compiler" \
  || bad "the skip must name the Apple SDK" "$out"
grep -qi "SKIP, not a pass" <<<"$out" \
  && ok "a skip is declared as a skip, never as a pass" \
  || bad "a silent skip is a non-gate" "$out"
grep -qi "unchecked here" <<<"$out" \
  && ok "and says the Swift is UNCHECKED on this machine" \
  || bad "the consequence must be stated" "$out"
rm -rf "$STUB"

# ── 2. no swiftc at all — the pre-existing branch, still working ────────────
EMPTY="$(mktemp -d)"
for c in bash mktemp rm printf grep cp dirname cd; do :; done
out=$(PATH="$EMPTY" /bin/bash "$SCRIPT" 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "no swiftc at all still skips rather than failing" \
                || bad "absent swiftc should skip" "exit $rc"
rm -rf "$EMPTY"

# ── 3. on a real Mac with the SDK it actually RUNS ─────────────────────────
# ⚠️ Without this the suite would pass on a machine where the script skips every time, which is
# the "allow-by-default arm is not a check" shape this repo has recorded.
if command -v swiftc >/dev/null 2>&1 && printf 'import HealthKit\n' > /tmp/_hk_probe.swift \
   && swiftc -typecheck /tmp/_hk_probe.swift >/dev/null 2>&1; then
  out=$(bash "$SCRIPT" 2>&1); rc=$?
  [ "$rc" -eq 0 ] && grep -q "typechecking" <<<"$out" \
    && ok "on a machine WITH the SDK it typechecks for real, it does not skip" \
    || bad "the SDK is present, so the script must run" "$out"
  grep -q "SKIPPED" <<<"$out" && bad "it skipped on a machine that has the SDK" "$out" \
                              || ok "and does not take the skip path here"
else
  echo "  · no Apple SDK on this machine — case 3 not applicable (it is the CI state)"
fi
rm -f /tmp/_hk_probe.swift

echo
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ]
