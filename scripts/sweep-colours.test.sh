#!/usr/bin/env bash
# ── Tests for scripts/sweep-colours.sh (GUARD-TREE-SWEEP-01) ────────────────
#
# ⚠️ WHY A BEHAVIOURAL TEST AND NOT A SOURCE ASSERTION. The sweep reports CLEAN on this
# repo today — 0 hits across 376 files — so a green run proves nothing about whether it
# can fire at all. This repo has shipped a green tick with nothing behind it more than
# once (`--section-gap`, a `flexShrink` that could never fire, two inert gates, a hollow
# inset-border check), and a source assertion passes on a comment.
#
# ⚠️ AND IT ASSERTS THE MESSAGE, NOT ONLY THE EXIT CODE. `pre-commit.test.sh` read the
# exit code alone, which is how a `set -u` crash passed 5 of its 11 cases while the hook
# was broken (found 2026-11-08, mid-build, by deleting the population line by accident).
# An exit 1 for the wrong reason is not a passing case.
#
# Runs the REAL script against scratch git repos.
set -uo pipefail
SWEEP="$(cd "$(dirname "$0")" && pwd)/sweep-colours.sh"
PASS=0; FAIL=0

# name · expect(hit|clean) · expected substring in output · path · content
run_case() {
  local name="$1" expect="$2" needle="$3" path="$4" content="$5"
  local tmp out rc got
  tmp="$(mktemp -d)"
  (
    cd "$tmp" || exit 1
    git init -q . && git config user.email t@t && git config user.name t
    mkdir -p "$(dirname "$path")"
    printf '%s' "$content" > "$path"
    git add -A >/dev/null 2>&1
  )
  out="$(cd "$tmp" && bash "$SWEEP" 2>&1)"; rc=$?
  [ $rc -ne 0 ] && got=hit || got=clean
  rm -rf "$tmp"
  if [ "$got" != "$expect" ]; then
    FAIL=$((FAIL+1)); printf '  ✗ %s — expected %s, got %s\n' "$name" "$expect" "$got"; return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qF "$needle"; then
    FAIL=$((FAIL+1)); printf '  ✗ %s — exit was right, but the output never said %q\n' "$name" "$needle"; return
  fi
  PASS=$((PASS+1)); printf '  ✓ %s\n' "$name"
}

echo "colour sweep"

# ── it can be made to go red, which a clean tree can never show ──
run_case "a hardcoded hex in live code is a HIT" hit "HARDCODED HEX" \
  "components/x.tsx" 'export const X = () => <div style={{ color: "#B5C0B4" }} />
'
run_case "a token FALLBACK hex is a HIT (the real 2026-10-01 defect)" hit "HARDCODED HEX" \
  "app/dashboard/layout.tsx" 'export const L = () => <div style={{ background: "var(--bg, #111)" }} />
'
run_case "a non-greyscale rgba is a HIT" hit "rgba" \
  "components/x.tsx" 'export const X = () => <div style={{ color: "rgba(91,192,190,0.4)" }} />
'
run_case "a retired System-B colour is a HIT" hit "BANNED palette" \
  "components/x.tsx" 'export const C = "#5BC0BE"
'
run_case "a banned font is a HIT" hit "BANNED font" \
  "components/x.tsx" 'export const F = "DM Sans"
'
run_case "setProperty is a HIT (ADR-008)" hit "setProperty" \
  "components/x.tsx" 'el.style.setProperty("--bg", "red")
'

# ── and it must stay quiet, because a guard that fires on ordinary work is switched off ──
run_case "a hex in a line comment is PROSE" clean "CLEAN" \
  "components/x.tsx" '// the darkest blurred backdrop sampled #B5C0B4
export const X = () => null
'
run_case "an rgb in a block comment is PROSE" clean "CLEAN" \
  "components/x.tsx" '/* measured rgb(181,192,180) on a device */
export const X = () => null
'
run_case "pure black at alpha is a SCRIM" clean "CLEAN" \
  "components/x.tsx" 'export const S = "rgba(0,0,0,0.4)"
'
run_case "an OG route keeps its hex (satori has no CSS vars)" clean "CLEAN" \
  "app/api/og/route.tsx" 'export const bg = "#F3F0EB" // --bg
'
run_case "a token-only component is CLEAN" clean "CLEAN" \
  "components/x.tsx" 'export const X = () => <div style={{ color: "var(--ink)" }} />
'
# 🔴 THE POPULATION, NOT JUST THE RULE. A hex under lib/ is outside this sweep by
# design — the palette rules govern app/ and components/ — and asserting it keeps the
# sweep from being quietly widened into the thing that fires on ordinary work.
run_case "a hex under lib/ is out of population" clean "CLEAN" \
  "lib/colours.ts" 'export const OG = "#F3F0EB"
'

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
