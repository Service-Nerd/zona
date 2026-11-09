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
. "$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)/lib/colour-guards.sh"
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

# 🔴 AN EMPTY POPULATION IS A BROKEN SWEEP, NOT A CLEAN ONE (code review, 2026-11-08). The
# first cut printed `CLEAN — 0 files, 5 rules, 0 hits` and exited 0 when `git ls-files` matched
# nothing — a renamed directory, a detached run, a changed glob. **Absence written as a value**,
# in a check whose whole job is to notice something nobody is looking at; and the suite's own
# "out of population" case runs through this very path, so it could not tell exclusion from
# total selection failure. The floor is deliberately generous: the real tree holds 376 files and
# the point is only to catch ZERO or near-zero.
MIN_POPULATION=${COLOUR_SWEEP_MIN_POPULATION:-50}
if [ "$n" -lt "$MIN_POPULATION" ]; then
  say ""
  say "✗  POPULATION TOO SMALL: $n files, expected at least $MIN_POPULATION."
  say "   A sweep with nothing to sweep reports CLEAN and means nothing. Check the globs,"
  say "   the working directory, and that this is the Zonna repo."
  exit 1
fi

# ⚠️ ONE PYTHON PROCESS FOR THE WHOLE TREE, NOT ONE PER FILE PER RULE (code review,
# 2026-11-08). The first cut looped the five rules over the file list, so `hex` and `rgba` each
# re-ran the stripper on all 376 files: **752 spawns, ~47s on every `verify:ci` run**, for a
# ratchet that finds nothing. `strip_comments_stream` emits `path:lineno:text` for every line of
# every file in ONE process, and the **regexes stay in grep** — the same `$HEX_RE` / `$RGBA_RE`
# the hook uses — so this is a faster reader of the owner's rules, not a second copy of them.
STREAM=$(mktemp); trap 'rm -f "$STREAM"' EXIT
printf '%s\n' "$files" | strip_comments_stream > "$STREAM"
stream_lines=$(wc -l < "$STREAM" | tr -d ' ')
if [ "$stream_lines" -eq 0 ]; then
  say ""
  say "✗  THE STRIPPER PRODUCED NO LINES for $n files. Unverified is never a pass."
  exit 1
fi

fail=0
# `banned` / `font` / `setp` read the WHOLE FILE, by inheritance from the hook: a retired
# System-B colour or a retired font NAMED in a comment is a reference nobody should be writing
# down either, and those three have never produced a false positive here.
hits_hex=$(grep -E "$HEX_RE" "$STREAM" | sed 's/^/  /' || true)
hits_rgba=$(grep -E "$RGBA_RE" "$STREAM" | grep -vE "$RGBA_SCRIM" | sed 's/^/  /' || true)
hits_banned=$(printf '%s\n' "$files" | xargs grep -nE "$BANNED_RE" 2>/dev/null | sed 's/^/  /' || true)
hits_font=$(printf '%s\n' "$files" | xargs grep -nE "$FONT_RE" 2>/dev/null | sed 's/^/  /' || true)
hits_setp=$(printf '%s\n' "$files" | xargs grep -nE "$SETP_RE" 2>/dev/null | sed 's/^/  /' || true)
# GUARD-COLOUR-KEYWORD-01 (2026-11-09) — reads the COMMENT-STRIPPED stream, like hex and rgba:
# a colour keyword in a comment is prose (HOOK-RGBA-COMMENTS-01), and this file's own header
# records that searching for the hardcoded colour finds the comment ABOUT it.
hits_keyword=$(grep -E "$KEYWORD_RE" "$STREAM" | sed 's/^/  /' || true)

report() {                       # kind  message  hits
  if [ -n "${3//[$'\n' ]/}" ]; then
    say ""; say "✗  $2"
    printf '%s\n' "$3" | grep . >&2
    fail=1
  else
    say "  ✓ $1"
  fi
}
report hex    "HARDCODED HEX in live code (comments are prose and were stripped):" "$hits_hex"
report rgba   "HARDCODED rgba() PALETTE value (pure black/white at alpha are scrims and allowed):" "$hits_rgba"
report banned "BANNED palette value (ember orange / warm beige / System B):" "$hits_banned"
report font   "BANNED font reference. Use var(--font-ui) or var(--font-brand):" "$hits_font"
report setp   "style.setProperty() — colour switching is not allowed (ADR-008):" "$hits_setp"
report keyword "CSS COLOUR KEYWORD as a property value. Use a globals.css token (--card is #FFFFFF):" "$hits_keyword"

say ""
if [ "$fail" -ne 0 ]; then
  say "COLOUR SWEEP: HITS FOUND (above). All colour must come from globals.css."
  exit 1
fi
say "COLOUR SWEEP: CLEAN — $n files, 6 rules, 0 hits"
exit 0
