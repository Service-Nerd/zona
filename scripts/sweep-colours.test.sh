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
    # ⚠️ A CLEAN IN-POPULATION COMPANION, so an EXCLUSION case still has a population. Without
    # it, "an OG route keeps its hex" and "a hex under lib/" selected ZERO files and tripped the
    # population floor — the case would have passed for the wrong reason, or failed for one.
    # It is token-only, so it can never contribute a hit.
    mkdir -p components
    printf 'export const Companion = () => <div style={{ color: "var(--ink)" }} />\n' \
      > components/__sweep_companion.tsx
    git add -A >/dev/null 2>&1
  )
  # ⚠️ THE POPULATION FLOOR IS LOWERED FOR THESE CASES, DELIBERATELY AND VISIBLY. The sweep
  # refuses a population under 50 files, because an empty one reports CLEAN and means nothing
  # (code review, 2026-11-08). A scratch repo holds one file, so the floor is injected at 1 —
  # the `CAP_CONFIG_PATH` pattern — and the floor itself gets its own cases below, run at the
  # DEFAULT, or lowering it here would quietly delete the arm it exists to test.
  out="$(cd "$tmp" && COLOUR_SWEEP_MIN_POPULATION=1 bash "$SWEEP" 2>&1)"; rc=$?
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
# 🔴 THE `//`-IN-A-STRING CASE (code review, 2026-11-08). Two regexes treat `//` inside a
# string as a comment start and blank the rest of the line, so a hex sitting beside ANY url was
# invisible to both the hook and the sweep. Latent at the time — 0 live lines matched — and the
# whole "376 files, 0 hits" claim rested on it.
run_case "a hex AFTER a url on the same line is a HIT" hit "HARDCODED HEX" \
  "components/x.tsx" 'export const T = { docs: "https://example.com", bg: "#B5C0B4" }
'
run_case "a url alone is still CLEAN" clean "CLEAN" \
  "components/x.tsx" 'export const T = { docs: "https://example.com" }
'
# 🔴 AND THE DESYNC CASE, which is why quote state is tracked PER LINE. A file-wide scanner
# meets one unbalanced apostrophe — JSX text, a regex literal — and treats everything after it
# as a string, so comments stop being recognised **for the rest of the file**. Measured on
# `buttonOwnership.test.ts`: desynced by line ~400, reporting a hex inside a `//` comment at
# line 688 as live code. A hand-rolled tokenizer fails silently and in the dangerous direction.
run_case "an unbalanced apostrophe does not blind later comments" clean "CLEAN" \
  "components/x.tsx" 'export const P = () => <p>it isnt here</p>
export const Q = () => <p>the family'"'"'s one exception</p>
// a later comment recording #B5C0B4 is still prose
'
run_case "and a hex in CODE after that apostrophe is still a HIT" hit "HARDCODED HEX" \
  "components/x.tsx" 'export const Q = () => <p>the family'"'"'s one exception</p>
export const R = "#B5C0B4"
'
# ⚠️ A SCRIM INSIDE A TEMPLATE LITERAL — the form the generating-ceremony shimmer used.
run_case "a palette rgba inside a template literal is a HIT" hit "rgba" \
  "components/x.tsx" 'export const G = `linear-gradient(90deg, rgba(91,192,190,0.2), transparent)`
'

# 🔴 THE POPULATION, NOT JUST THE RULE. A hex under lib/ is outside this sweep by
# design — the palette rules govern app/ and components/ — and asserting it keeps the
# sweep from being quietly widened into the thing that fires on ordinary work.
run_case "a hex under lib/ is out of population" clean "CLEAN" \
  "lib/colours.ts" 'export const OG = "#F3F0EB"
'


# ── 🔴 THE FLOOR ITSELF, AT THE DEFAULT (code review, 2026-11-08) ──
# `CLEAN — 0 files, 5 rules, 0 hits`, exit 0, was the first cut's answer to a population that
# selected nothing: a renamed directory, a changed glob, a run from the wrong place. **Absence
# written as a value**, in the check whose entire job is to notice what nobody is looking at.
floor_case() {                   # name  expect(refuse|ran)  path  content
  local name="$1" expect="$2" path="$3" content="$4"
  local tmp out got; tmp="$(mktemp -d)"
  out="$(
    cd "$tmp" || exit 1
    git init -q . && git config user.email t@t && git config user.name t
    mkdir -p "$(dirname "$path")" 2>/dev/null
    [ -n "$content" ] && printf '%s' "$content" > "$path"
    git add -A >/dev/null 2>&1
    bash "$SWEEP" 2>&1
  )"
  rm -rf "$tmp"
  if printf '%s' "$out" | grep -qF "POPULATION TOO SMALL"; then got=refuse; else got=ran; fi
  if [ "$got" = "$expect" ]; then
    PASS=$((PASS+1)); printf '  ✓ %s\n' "$name"
  else
    FAIL=$((FAIL+1)); printf '  ✗ %s — expected %s, got %s\n' "$name" "$expect" "$got"
  fi
}
floor_case "an EMPTY population is refused, not reported CLEAN" refuse "components/x.tsx" ''
floor_case "a one-file population is refused at the default floor" refuse "components/x.tsx" \
  'export const X = () => null
'
# And the real tree must clear it, or the floor is set wrong — this is the arm that would have
# caught a floor of 500.
if bash "$SWEEP" --quiet 2>/dev/null || [ $? -eq 1 ]; then
  if bash "$SWEEP" 2>&1 | grep -qF "POPULATION TOO SMALL"; then
    FAIL=$((FAIL+1)); printf '  ✗ the REAL repo must clear the floor — it does not\n'
  else
    PASS=$((PASS+1)); printf '  ✓ the real repo clears the floor\n'
  fi
fi

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
