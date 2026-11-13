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

# ── 🔴 AN EXIT CODE IS NOT A REASON (added 2026-11-08, GUARD-TREE-SWEEP-01) ──
#
# `run_case` above reads the hook's EXIT CODE only. On 2026-11-08, mid-build, the
# population line (`STAGED=`) was deleted by accident while the colour predicates were
# being extracted into `scripts/lib/colour-guards.sh`. Under `set -u` the hook then died
# on an unbound variable and exited non-zero for EVERY input — and **5 of these 11 cases
# passed**, because every one of them expects `block`. A hook reduced to `exit 1` scores
# the same 5. The six `pass` cases caught it, which is the whole argument for testing
# both directions, but half the suite was hollow for as long as it existed.
#
# So: a blocking case must also NAME ITS RULE in the output. An exit 1 for the wrong
# reason is not a passing case.
run_msg() {            # name  needle  path  content
  local name="$1" needle="$2" path="$3" content="$4"
  local tmp out; tmp="$(mktemp -d)"
  out="$(
    cd "$tmp" || exit 1
    git init -q . && git config user.email t@t && git config user.name t
    mkdir -p "$(dirname "$path")"
    printf '%s' "$content" > "$path"
    git add -A >/dev/null 2>&1
    bash "$HOOK" 2>&1
  )"
  rm -rf "$tmp"
  if printf '%s' "$out" | grep -qF "$needle"; then
    PASS=$((PASS+1)); printf '  ✓ %s\n' "$name"
  else
    FAIL=$((FAIL+1)); printf '  ✗ %s — the hook never said %q (it may have crashed)\n' "$name" "$needle"
  fi
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

# ── GUARD-COLOUR-KEYWORD-01: a colour KEYWORD, both directions ──
# The rule that both numeric rules were blind to. Scoped to a colour property's whole
# VALUE, so the words themselves are not the trigger.
run_case "a colour KEYWORD as a property value blocks" block "components/x.tsx" \
  "export const X = () => <div style={{ color: 'white' }} />
"
run_case "a keyword in a COMMENT is prose and passes" pass "components/x.tsx" \
  "// this used to be color: 'white' before the token
export const X = () => <div style={{ color: 'var(--card)' }} />
"
run_case "a variant NAMED after a colour is not a colour declaration" pass "components/x.tsx" \
  "const variant = 'red'
export const X = () => <div data-variant={variant} />
"
run_case "transparent and currentColor are legal CSS and pass" pass "components/x.tsx" \
  "export const X = () => <div style={{ background: 'transparent', fill: 'currentColor' }} />
"

# ── the blocking cases must name their rule, not merely exit non-zero ──
run_msg "a hex block SAYS it is a hex colour" "Hardcoded hex colour" "components/x.tsx" \
  'export const X = () => <div style={{ color: "#B5C0B4" }} />
'
run_msg "an rgba block SAYS it is an rgba palette colour" "Hardcoded rgba" "components/x.tsx" \
  'export const X = () => <div style={{ color: "rgba(91,192,190,0.4)" }} />
'
run_msg "a keyword block SAYS it is a colour keyword" "colour KEYWORD" "components/x.tsx" \
  "export const X = () => <div style={{ background: 'navy' }} />
"
run_msg "a banned-value block SAYS which family" "Banned palette value" "components/x.tsx" \
  'export const C = "#5BC0BE"
'

# ── BRAND-COACHNAME-HARDCODED-01 — the coach's name is BRAND.coachName ──────────
run_case "a hardcoded coach name in a component BLOCKS" block "components/x.tsx" \
  'export const X = () => <div>Kit is reading</div>
'
run_case "a hardcoded coach name in a string BLOCKS" block "components/x.tsx" \
  'export const MSG = "Kit noticed"
'
run_case "a hardcoded coach name in an API route BLOCKS — notifications are runner-facing" block "app/api/push/x.ts" \
  'export const body = "Kit can reach you"
'
run_case "the name inside a LINE comment passes — prose, not code" pass "components/x.tsx" \
  '// Kit is the coach name; this sentence is about it, not using it.
export const X = () => <div>{BRAND.coachName}</div>
'
run_case "the name inside a BLOCK comment passes" pass "components/x.tsx" \
  '/** Why this card exists: Kit speaks first, then the facts. */
export const X = () => <div>{BRAND.coachName}</div>
'
run_case "a hardcoded name in lib/ BLOCKS — push titles live there" block "lib/notifications.ts" \
  'export const TITLE = "Kit noticed something."
'
run_case "lib/brand.ts is exempt — it is the definition site" pass "lib/brand.ts" \
  "const COACH_NAME = 'Kit'
"
run_case "a PRODUCTION route with preview in its path is NOT exempt" block "app/api/email/preview/route.ts" \
  'export const TITLE = "Kit noticed something."
'
run_case "a comment ABOUT the name passes" pass "components/x.tsx" \
  '// What Kit knows about you is the eyebrow on this card.
export const X = () => <div>{BRAND.coachName}</div>
'
run_case "code AFTER a comment on the same line still blocks" block "components/x.tsx" \
  'export const MSG = "Kit noticed" // renamed from the old copy
'
run_case "a -preview harness is out of the population" pass "components/copy-preview/x.tsx" \
  'export const X = () => <div>Kit is reading</div>
'
run_case "a test file is out of the population" pass "components/x.test.tsx" \
  'export const X = () => <div>Kit is reading</div>
'
run_case "an unrelated word containing the name passes" pass "components/x.tsx" \
  'import { HealthKit } from "./hk"
export const X = () => <div>{HealthKit.name}</div>
'
run_msg "a coach-name block SAYS to use BRAND.coachName" "BRAND.coachName" "components/x.tsx" \
  'export const MSG = "Kit noticed"
'

echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
