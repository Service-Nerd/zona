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

# 🔴 SITES, NOT IDS, FOR THE BOARD TALLY (BACKLOG-TAG-IN-HEADING-01, 2026-11-08). The first
# cut of this block counted every line carrying a board glyph and reported 102 coaching items
# where there are ~31 — it counted closed headings and body mentions alike. The second cut
# derived the board PER OPEN ID, which was right, but found that id by scanning for the first
# line in file order CONTAINING it — a MENTION, not a filing. `PARITY-STAGED-BLIND-01` is
# tagged on its own bullet at L219 and read as UNTAGGED because L202 names it inside another
# item's ✅ SHIPPED bullet. **The owner now emits the line it derived each id from, so the board
# is read off the item's own filing and nothing else.**
{ heading_open_sites "$BL"; board_tag_bullet_sites "$BL"; } | sort -u -k2,2 > /tmp/_bo_sites
cut -f2 /tmp/_bo_sites | sort -u > /tmp/_bo_open
# A registry id in a row's FIRST cell — the same shape `audit-docs.sh` reads.
sed -nE 's/^\| *`?([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)`?[^|—]{0,60}[—|].*/\1/p' "$REG" | sort -u > /tmp/_bo_reg

total=$(wc -l < /tmp/_bo_open | tr -d ' ')
shipped=$(comm -12 /tmp/_bo_open /tmp/_bo_reg | wc -l | tr -d ' ')

printf '\n── OPEN BACKLOG ITEMS, as the gate derives them ──\n\n'
printf '  %s items the gate reads as open\n' "$total"
printf '  %s of those carry a SHIPPED feature-registry row\n' "$shipped"
printf '    (each must be a declared partial in audit-docs.sh, or it is a missing stamp)\n\n'

printf '── by board (from the OWNER, per item, earliest glyph wins) ──\n'
# ⚠️ THE DERIVATION IS NOT HERE. `open_item_boards` in `scripts/lib/open-items.sh` owns it,
# because `backlog-verify.mjs` needs the same answer to GATE the filing rule and two copies
# would disagree about which board owns an item — the one thing it exists to say.
open_item_boards "$BL" > /tmp/_bo_boards
for b in COACHING DESIGN SLT FOUNDER "NO BOARD" "?"; do
  c=$(cut -f2 /tmp/_bo_boards | grep -cx "$b" || true)
  label="$b"; [ "$b" = "?" ] && label="untagged"
  printf '  %-10s %s\n' "$label" "$c"
done
if cut -f2 /tmp/_bo_boards | grep -qx '?'; then
  printf '\n  ── untagged, at their own filing line (the filing rule has no tag here) ──\n'
  awk -F'\t' '$2 == "?" { printf "    L%-6s %s\n", $3, $1 }' /tmp/_bo_boards
fi

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
