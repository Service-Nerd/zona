#!/usr/bin/env bash
# ── THE SINGLE OWNER OF "WHICH BACKLOG ITEMS ARE OPEN?" ─────────────────────
#
# 🔴 EXTRACTED 2026-11-07 (`BACKLOG-PARENT-HEADING-BLIND-01`) SO THERE CAN ONLY EVER BE ONE
# ANSWER. `audit-docs.sh` and `backlog-open.sh` both source this; neither holds a copy.
#
# The reason is this repo's most expensive recurring defect, and it has a register:
# `deloadCadence`, `tierResolution`, `supersedeCoverage`, `OPS-AI-OWNER-01`, `SESSION-KM-01`.
# A second copy of a derivation agrees with the first only by accident, and the accident ends
# silently. Here it would end the worst possible way: the gate would say a thing is closed
# while the report a human reads says it is open, or the reverse.
#
# ⚠️ `openItemsSingleOwner.test.ts` fails if either caller defines these names itself.
set -uo pipefail

board_tag_bullet_ids() {
  sed -nE 's/^- (🏃|🧭|💼|👤|⚙️) \*\*[^*]+\*\* `?([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)`?([^A-Z0-9-].*)?$/\2/p' "$1"
}

# ── THE CLOSED VOCABULARY — ONE LIST, SHARED BY EVERY OPEN-ITEM ARM ─────────
#
# 🔴 BACKLOG-STATUS-GLYPH-BLIND-01 (2026-11-07). THE EIGHTH INSTANCE OF "AN AUDIT IS ONLY
# EVER AS WIDE AS ITS LIST", AND THIS SCRIPT PREDICTED IT THREE TIMES IN ITS OWN COMMENTS:
# *"normalising the document is the better fix and is still not done."*
#
# The open-item population used to be built from a HAND-LISTED SET OF EMOJI
# (🔻 🔲 🟡 🟠 🟢 🔵 ⏸️ ⚖️ 🧭) plus a second arm for UNMARKED headings. So a heading led by any
# other glyph — ⚙️ 🏃 👤 📱 🔄 🔧 ⚠️ 🔴 — matched NEITHER: not the emoji list, and not the
# unmarked arm, whose pattern requires a backtick immediately after the hashes. **Measured:
# 35 open headings invisible to both arms, 9 of them carrying a shipped feature-registry
# row**, while this script printed ALL CLEAN.
#
# ⚠️ AND THE EXCLUSION WORDS ONLY EVER PROTECTED THE UNMARKED ARM, which is why 🔴 had to be
# excluded by EMOJI: in the `###` form it was being used for both KILLED (W-06 "WITHDRAWN",
# W-11 "DEAD") and OPEN-AT-P1 (`PLAN-NOTE-BUDGET-INERT-01`), and no emoji rule can separate
# those. **Closing by WORDS separates them, because the document already says which it means.**
#
# So: ONE arm, ANY leading glyph, and an item is CLOSED only when it SAYS so. A new status
# glyph can never make the arm blind again, because the arm no longer knows about glyphs.
_CLOSED_STAMPS='SHIPPED|CLOSED|RESOLVED|WITHDRAWN|SUPERSEDED|DEAD|PARKED|KILLED|VACATED|FALSE PREMISE|BUILT and LIVE'
_CLOSED_PROSE='for the record|NOT an open item|do not re-propose'

# Every `###`/`####` heading that names an item and does not say it is closed.
#
# 🔴 THE CLOSED-WORD TEST MUST NOT READ THE ID, AND THE FIRST CUT OF THIS FUNCTION DID.
# `QUIT-TAB-DEAD-01`, `ADJUST-TRIGGER-MANUAL-DEAD-01` and `ZONE-DISCIPLINE-BANDS-DEAD-01`
# all excluded THEMSELVES, because their NAMES contain "DEAD". Matching the spelling instead
# of the claim — the class this repo has recorded repeatedly, committed here inside the gate
# written to end a different instance of it. So every backticked span is blanked before the
# test, and the id is recovered from the original line afterwards.
#
# ⚠️ THE STAMP WORDS ARE MATCHED CASE-SENSITIVELY AND THAT IS DELIBERATE. This file writes a
# closure as a CAPITALISED stamp (**DEAD**, **WITHDRAWN**, ✅ SHIPPED), so requiring caps keeps
# ordinary prose ("a deadline", "shipped copy") from closing an open item. Only the two
# sentence-shaped markers are case-insensitive, because they are written as prose.
heading_open_ids() {
  awk -v stamps="$_CLOSED_STAMPS" -v prose="$_CLOSED_PROSE" '
    /^##/ {
      line = $0
      bare = line
      gsub(/`[^`]*`/, "@@", bare)          # the id and any filename cannot vote on status
      if (index(bare, "\342\234\205") || index(bare, "~~")) next
      n = split(stamps, w, "|"); for (i = 1; i <= n; i++) if (index(bare, w[i])) next
      lo = tolower(bare)
      m = split(prose, q, "|");  for (i = 1; i <= m; i++) if (index(lo, tolower(q[i]))) next

      # 🔴 A `##` PARENT HEADING IS AN ITEM TOO, AND NO ARM HAS EVER READ ONE (2026-11-07).
      # The founder asked whether FIRSTRUN-MARATHON-01 was built. It was: touchpoint 7 shipped
      # 2026-10-05 and every named blocker before it, all in production. Its parent heading is
      # `## 🥇 P0 — FIRSTRUN-MARATHON-01`, which carries NO stamp and NO backticks, and every
      # open-item arm matched `^###` — so the largest item in the file, the declared P0, was
      # outside every population in BOTH directions. **26 `##` headings name an item; 22 have a
      # shipped registry row; 18 of those are unstamped.**
      # ⚠️ MEASURED BEFORE WIDENING, as this script requires: excluding the FILING-SESSION
      # convention (`## ⚖️ FILED <date> — ...`, `## ... SHIPPING ...`) — which records WHEN
      # something was filed and is not a status — leaves exactly TWO, both genuine, ZERO false
      # positives. Same measurement shape the unmarked arm was added with.
      if (line ~ /^## /) {
        if (line ~ /^## .{0,8}(FILED|SHIPPING|Filed|Shipping)/) next
        # a `##` parent names its id WITHOUT backticks by convention, so accept a bare id
        if (match(line, /[A-Z][A-Z0-9]*(-[A-Z0-9]+)+-[0-9][0-9]/) == 0) next
        print substr(line, RSTART, RLENGTH); next
      }

      # `###`/`####` keep the backticked convention: it is what stops a sentence-shaped
      # heading that MENTIONS an id from being read as that id\x27s filing.
      if (line !~ /^###/) next
      if (match(line, /`[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`/) == 0) next
      print substr(line, RSTART + 1, RLENGTH - 2)
    }' "$1"
}

