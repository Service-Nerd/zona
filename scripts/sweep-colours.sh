#!/usr/bin/env bash
# ── `npm run sweep:colours` — THE TREE, NOT THE DIFF ────────────────────────
#
# 🔴 WHY THIS EXISTS (`GUARD-TREE-SWEEP-01`). `.githooks/pre-commit` reads STAGED FILES
# ONLY, which is not a bug — it is the shape of every commit-time check. A guard scoped
# to the diff cannot see code already in place. Measured 2026-10-01: the one live
# hardcoded hex in the whole app was `var(--bg, #111)` in `app/dashboard/layout.tsx`, a
# dark-mode fallback that survived ADR-008 and would have painted the dashboard
# near-black under a single LIGHT theme — alive purely because nothing had touched that
# file for months. **The hook could never have found it. Nothing else was looking.**
#
# ⚠️ IT IS A RATCHET, NOT A BUG FINDER, AND THE ITEM SAYS SO. Re-measured 2026-11-08:
# **0 hits across 376 files** — hex, rgba palette and banned values alike. Whoever reads
# this should not expect it to find a defect. What it buys is that the clean state cannot
# silently rot, which is worth less than the item implied and is still worth something.
#
# ⚠️ IT MUST STRIP COMMENTS, and that is a joke at the item's own expense: searching for
# the hardcoded colour finds the COMMENT ABOUT the hardcoded colour, which is
# `HOOK-RGBA-COMMENTS-01` exactly — *a colour inside a comment is prose*. It does not hold
# its own stripper; `scripts/lib/colour-guards.sh` owns it, and the hook sources the same
# file, so the sweep can never enforce a looser rule than the commit guard.
set -uo pipefail
# cwd is the git root being swept — which `sweep-colours.test.sh` points at a scratch
# repo, so the REAL script is exercised rather than a copy of its regexes. The LIBRARY,
# though, is resolved from this script's own directory: a path relative to cwd would
# silently find nothing in a scratch repo, and `set -u` would then make the sweep fail
# for the wrong reason — which is how a deny-by-default arm passes a test suite that
# only reads the exit code.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/colour-guards.sh"
cd "$(git rev-parse --show-toplevel)"

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
say() { [ "$QUIET" = 1 ] || printf '%s\n' "$*"; }

files=$(git ls-files 'app/*' 'components/*' \
        | grep -E "$COLOUR_FILE_REGEX" \
        | grep -vE "$PALETTE_EXEMPT_REGEX" || true)
n=$(printf '%s\n' "$files" | grep -c . || true)

say ""
say "── COLOUR SWEEP: the whole tree, not the staged diff ──"
say "  population: $n files under app/ and components/ (OG routes exempt by CLAUDE.md)"

fail=0
for kind in hex rgba banned font setp; do
  hits=""
  for f in $files; do
    out=$(colour_violations "$kind" "$f" || true)
    [ -n "$out" ] && hits="$hits$(printf '%s\n' "$out" | sed "s|^|  $f:|")
"
  done
  if [ -n "${hits//[$'\n' ]/}" ]; then
    say ""
    case "$kind" in
      hex)    say "✗  HARDCODED HEX in live code (comments are prose and were stripped):" ;;
      rgba)   say "✗  HARDCODED rgba() PALETTE value (pure black/white at alpha are scrims and allowed):" ;;
      banned) say "✗  BANNED palette value (ember orange / warm beige / System B):" ;;
      font)   say "✗  BANNED font reference. Use var(--font-ui) or var(--font-brand):" ;;
      setp)   say "✗  style.setProperty() — colour switching is not allowed (ADR-008):" ;;
    esac
    printf '%s' "$hits" | grep . >&2
    fail=1
  else
    say "  ✓ $kind"
  fi
done

say ""
if [ "$fail" -ne 0 ]; then
  say "COLOUR SWEEP: HITS FOUND (above). All colour must come from globals.css."
  exit 1
fi
say "COLOUR SWEEP: CLEAN — $n files, 5 rules, 0 hits"
exit 0
