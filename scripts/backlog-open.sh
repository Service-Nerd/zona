#!/usr/bin/env bash
# ── `npm run backlog:open` — WHAT IS OPEN, DERIVED, NEVER READ ──────────────
#
# 🔴 WHY THIS EXISTS. On 2026-11-07 the founder asked whether `FIRSTRUN-MARATHON-01` was
# built. It was: every touchpoint shipped between 2026-09-18 and 2026-10-05, all of it in
# production. **I had told him it was the open P0 — and my own cross-check, three messages
# earlier in the same session, had printed that it carried both a shipped registry row AND a
# build-log entry. I printed the refutation and read past it.**
#
# The structural half is fixed in `heading_open_ids` (a `##` parent heading is an item too).
# This is the other half: **the answer to "what is open?" now comes out of the same derivation
# the gate uses, in one command, instead of out of me reading a 21,000-line file.**
#
# ⚠️ IT PRINTS WHAT THE GATE CAN SEE, AND SAYS SO. It is not a verified count of live work:
# an item's premise can have dissolved while its heading still reads open, which this repo
# records as "an item is a snapshot of the code on the day it was written".
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
. "$(git rev-parse --show-toplevel)/scripts/lib/open-items.sh"

BL=docs/releases/backlog.md
REG=docs/canonical/feature-registry.md
LOG=docs/build-log.md

{ heading_open_ids "$BL"; board_tag_bullet_ids "$BL"; } | sort -u > /tmp/_bo_open
# A registry id in a row's FIRST cell — the same shape `audit-docs.sh` reads.
sed -nE 's/^\| *`?([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)`?[^|—]{0,60}[—|].*/\1/p' "$REG" | sort -u > /tmp/_bo_reg

total=$(wc -l < /tmp/_bo_open | tr -d ' ')
shipped=$(comm -12 /tmp/_bo_open /tmp/_bo_reg | wc -l | tr -d ' ')

printf '\n── OPEN BACKLOG ITEMS, as the gate derives them ──\n\n'
printf '  %s items the gate reads as open\n' "$total"
printf '  %s of those carry a SHIPPED feature-registry row\n' "$shipped"
printf '    (each must be a declared partial in audit-docs.sh, or it is a missing stamp)\n\n'

# 🔴 THE FIRST CUT OF THIS BLOCK COUNTED EVERY LINE CARRYING A BOARD GLYPH and reported
# 102 coaching items where there are ~32 — it counted CLOSED headings and body mentions
# alike. A report that overstates is the thing this whole script exists to stop, so the
# board is now derived PER OPEN ID from that id's own heading or bullet.
printf '── by board (derived per open id, from its own heading) ──\n'
awk -v ids="$(tr '\n' ' ' < /tmp/_bo_open)" '
  BEGIN { n = split(ids, a, " "); for (i = 1; i <= n; i++) if (a[i] != "") want[a[i]] = 1 }
  /^#{2,4} / || /^- / {
    for (id in want) {
      if (index($0, id) == 0) continue
      if (id in seen) continue
      seen[id] = 1
      b = "?"
      if (index($0, "\360\237\217\203") || index($0, "\342\232\225") || index($0, "\360\237\251\271")) b = "COACHING"
      else if (index($0, "\360\237\247\255")) b = "DESIGN"
      else if (index($0, "\360\237\222\274")) b = "SLT"
      else if (index($0, "\360\237\221\244")) b = "FOUNDER"
      else if (index($0, "\342\232\231")) b = "NO BOARD"
      tally[b]++
    }
  }
  END {
    order = "COACHING DESIGN SLT FOUNDER NO BOARD ?"
    printf "  %-10s %s\n", "COACHING", tally["COACHING"] + 0
    printf "  %-10s %s\n", "DESIGN",   tally["DESIGN"] + 0
    printf "  %-10s %s\n", "SLT",      tally["SLT"] + 0
    printf "  %-10s %s\n", "FOUNDER",  tally["FOUNDER"] + 0
    printf "  %-10s %s\n", "NO BOARD", tally["NO BOARD"] + 0
    printf "  %-10s %s   <- untagged: the filing rule has no gate (BACKLOG-TAG-IN-HEADING-01)\n", "untagged", tally["?"] + 0
  }' "$BL"

printf '\n── BLOCKED: nobody here can move these ──\n'
grep -nE '^#{2,4} .*BLOCKED ON A DEVICE' "$BL" | sed -E 's/^([0-9]+):#+ /  L\1  /' | cut -c1-120 || true

printf '\n── shipped AND open (declared partials excluded by the gate) ──\n'
comm -12 /tmp/_bo_open /tmp/_bo_reg | sed 's/^/  /'

printf '\n⚠️  WHAT THIS DOES NOT TELL YOU\n'
printf '    · It counts what the GATE can see, not verified live work. An item whose premise\n'
printf '      dissolved still reads open until someone re-measures it.\n'
printf '    · It cannot see a ship recorded only under ANOTHER item'"'"'s id — there is nothing\n'
printf '      to join against (audit-docs.sh records that gap too, unfixed).\n'
printf '    · A number here is a read of two documents. Before planning against any item,\n'
printf '      re-derive its own stated figures from the code.\n\n'
