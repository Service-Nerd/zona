#!/usr/bin/env bash
# ── THE SINGLE OWNER OF "IS THIS A HARDCODED COLOUR?" ───────────────────────
#
# 🔴 EXTRACTED 2026-11-08 (`GUARD-TREE-SWEEP-01`) so the commit-time guard and the
# tree-wide sweep cannot drift. `.githooks/pre-commit` and `scripts/sweep-colours.sh`
# both source this; neither holds a copy of a regex or of the comment stripper.
#
# The reason is this repo's most expensive recurring defect and it has a register:
# `deloadCadence`, `tierResolution`, `supersedeCoverage`, `OPS-AI-OWNER-01`,
# `SESSION-KM-01`, `open-items.sh`. A second copy of a predicate agrees with the first
# only by accident, and the accident ends silently. Here it would end the worst way:
# the sweep reporting a clean tree under a looser rule than the one the hook enforces,
# so a colour that cannot be committed is never found in the code already shipped.
#
# ⚠️ THE TWO CHECKS ANSWER DIFFERENT QUESTIONS AND BOTH ARE RIGHT.
# The hook reads STAGED FILES ONLY — which is not a bug, it is the shape of every
# commit-time check: a guard scoped to the diff cannot see the tree. The sweep reads
# the TREE, so a clean state cannot silently rot in a file nobody touches. Measured
# 2026-10-01: the one live hardcoded hex in the whole app was `var(--bg, #111)` in the
# dashboard layout — a dark-mode fallback that survived ADR-008 and would have painted
# the dashboard near-black — alive purely because nothing had touched that file for
# months. The hook could never have seen it.
#
# ⚠️ `colour_violations` STRIPS COMMENTS. `HOOK-RGBA-COMMENTS-01`: a comment RECORDING a
# measured colour is prose, not a style, and a guard that fires on ordinary work gets
# switched off — which this repo has recorded four times as equivalent to no guard.
# Line numbers are PRESERVED: comment text is blanked, never deleted.
set -uo pipefail

# `app/api/og/**` is excluded from the palette checks. `next/og` renders in a satori
# runtime with no CSS custom properties, so a token resolves to nothing and the image
# comes out unstyled. CLAUDE.md records this exception by name. Those files carry the
# hex WITH the token name in a trailing comment, which is the reviewable form.
PALETTE_EXEMPT_REGEX='^app/api/og/'

# Files the palette rules govern: TS/JS under app/ and components/. `globals.css` is
# the token authority and is excluded at selection, not here.
COLOUR_FILE_REGEX='\.(tsx?|jsx?)$'

HEX_RE='#[0-9A-Fa-f]{3,8}\b'

# ⚠️ DELIBERATELY QUIET. Pure white and pure black at alpha are SCRIMS — there is no
# token for a scrim and there should not be one. Only a NON-greyscale triple is a
# palette colour wearing an alpha channel, and that is all this matches.
RGBA_RE='rgba?\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}'
RGBA_SCRIM='rgba?\(\s*(0\s*,\s*0\s*,\s*0|255\s*,\s*255\s*,\s*255)\s*[,)]'

BANNED_RE='#D4501A|#f5f2ee|#F5F2EE|#0B132B|#5BC0BE|rgba?\(212, ?80, ?26|rgba?\(11, ?19, ?43|rgba?\(91, ?192, ?190'
FONT_RE='DM Mono|DM Sans|Space Grotesk|Bebas Neue'
SETP_RE='\.style\.setProperty\('

strip_comments() {
  python3 -I - "$1" <<'PYSTRIP'
import re, sys
src = open(sys.argv[1], encoding='utf-8', errors='replace').read()
blank = lambda m: re.sub(r'[^\n]', ' ', m.group(0))
src = re.sub(r'/\*[\s\S]*?\*/', blank, src)   # block comments, newlines kept
src = re.sub(r'//[^\n]*', blank, src)         # line comments
sys.stdout.write(src)
PYSTRIP
}

# colour_violations <kind> <file>  →  prints `line:text` for each hit, exits 1 if any.
# kinds: hex | rgba | banned | font | setp
#
# ⚠️ `hex` and `rgba` read COMMENT-STRIPPED source; `banned`, `font` and `setp` read the
# WHOLE FILE, and that asymmetry is deliberate and inherited. A retired System-B colour
# or a retired font named in a comment is a reference nobody should be writing down
# either, and the three have never produced a false positive here.
colour_violations() {
  local kind="$1" f="$2"
  [ -f "$f" ] || return 0
  case "$kind" in
    hex)    strip_comments "$f" | grep -nE "$HEX_RE" ;;
    rgba)   strip_comments "$f" | grep -nE "$RGBA_RE" | grep -vE "$RGBA_SCRIM" ;;
    banned) grep -nE "$BANNED_RE" "$f" ;;
    font)   grep -nE "$FONT_RE" "$f" ;;
    setp)   grep -nE "$SETP_RE" "$f" ;;
    *)      echo "colour_violations: unknown kind '$kind'" >&2; return 2 ;;
  esac
}
