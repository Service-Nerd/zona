#!/usr/bin/env bash
# HOOK-RGBA-COMMENTS-01 — tests for the pre-commit colour guards.
#
# ⚠️ WHY A TEST EXISTS NOW. `.claude/hooks/*` each carry a `.test.py` and this
# hook carried nothing, so the two colour checks were never exercised in either
# direction. The defect they had was not a missing rule, it was the rule firing
# on PROSE: a comment recording a measured colour read as a hardcoded palette
# value. This repo has recorded FOUR times that a guard which fires on ordinary
# work gets switched off, which it also records as equivalent to having no guard.
#
# Runs the REAL hook against a scratch git repo, so it tests the script rather
# than a copy of its regexes.
set -uo pipefail
HOOK="$(cd "$(dirname "$0")" && pwd)/pre-commit"
PASS=0; FAIL=0

run_case() {           # name  expect(block|pass)  path  content
  local name="$1" expect="$2" path="$3" content="$4"
  local tmp; tmp="$(mktemp -d)"
  (
    cd "$tmp" || exit 1
    git init -q . && git config user.email t@t && git config user.name t
    mkdir -p "$(dirname "$path")"
    printf '%s' "$content" > "$path"
    git add -A >/dev/null 2>&1
    bash "$HOOK" >/dev/null 2>&1
  )
  local rc=$?
  local got; [ $rc -ne 0 ] && got=block || got=pass
  if [ "$got" = "$expect" ]; then
    PASS=$((PASS+1)); printf '  ✓ %s\n' "$name"
  else
    FAIL=$((FAIL+1)); printf '  ✗ %s — expected %s, got %s\n' "$name" "$expect" "$got"
  fi
  rm -rf "$tmp"
}

echo "pre-commit colour guards"

# ── the defect: prose about a measurement must NOT be blocked ──
run_case "hex in a line comment passes" pass "components/x.tsx" \
  '// the darkest blurred backdrop sampled #B5C0B4
export const X = () => null
'
run_case "rgb in a line comment passes" pass "components/x.tsx" \
  '// measured: the backdrop is rgb(181,192,180) at the darkest point
export const X = () => null
'
run_case "rgb in a block comment passes" pass "components/x.tsx" \
  '/* measured rgb(181,192,180) on a device, 2026-09-26 */
export const X = () => null
'

# ── the rule still bites in code ──
run_case "hex in CODE blocks" block "components/x.tsx" \
  'export const X = () => <div style={{ color: "#B5C0B4" }} />
'
run_case "rgb in CODE blocks" block "components/x.tsx" \
  'export const X = () => <div style={{ color: "rgb(181,192,180)" }} />
'
run_case "a token fallback hex in CODE blocks" block "app/dashboard/layout.tsx" \
  'export const X = () => <div style={{ background: "var(--bg, #111)" }} />
'

# ── the deliberate quiet: scrims are not palette ──
run_case "pure black at alpha passes (a scrim)" pass "components/x.tsx" \
  'export const X = () => <div style={{ background: "rgba(0,0,0,0.4)" }} />
'
run_case "pure white at alpha passes (a scrim)" pass "components/x.tsx" \
  'export const X = () => <div style={{ background: "rgba(255,255,255,0.6)" }} />
'

# ── scope: the token authority and the OG exemption ──
run_case "an OG route keeps its hex (satori has no CSS vars)" pass "app/api/og/route.tsx" \
  'export const X = () => <div style={{ color: "#B5C0B4" }} />
'

# ── the trap this stripper must not fall into ──
run_case "code AFTER a comment on the same line still blocks" block "components/x.tsx" \
  'export const X = () => <div /* note */ style={{ color: "#B5C0B4" }} />
'
run_case "a hex inside a STRING is code, not prose" block "components/x.tsx" \
  'export const LABEL = "brand hex is #B5C0B4"
'

echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
