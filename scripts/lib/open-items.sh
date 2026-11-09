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

# ── SITES, NOT JUST IDS (BACKLOG-TAG-IN-HEADING-01, 2026-11-08) ─────────────
#
# 🔴 WHY BOTH SHAPES NOW EMIT `lineno<TAB>id`. `backlog-open.sh` derived each item's BOARD by
# scanning for the first line in file order that CONTAINED the id — which is a MENTION, not a
# filing. Measured 2026-11-08: `PARITY-STAGED-BLIND-01` is tagged `⚙️ NO BOARD` on its own
# bullet at L219 and was reported UNTAGGED, because L202 names it inside a different item's
# ✅ SHIPPED bullet; `COACHING-ROUND-WARNS-BLIND-01` and `DOCS-RESIDUAL-01` are tagged on
# their `###` headings and were reported untagged because a `## ⚖️ FILED …` parent names them
# first. **A substring search cannot tell "this line files X" from "this line mentions X" —
# the `GTM-CHARITY-02` class, for the fourth time in this repo, in code shipped yesterday.**
#
# So the owner emits the SITE it derived the id from, and every caller reads the item's own
# line. `heading_open_ids` / `board_tag_bullet_ids` keep their id-only contract for the callers
# that only want the set.
board_tag_bullet_sites() {
  # ⚠️ LITERAL GLYPHS, NEVER BYTE ESCAPES. `lib/docs/itemXref.test.ts` reads this
  # alternation out of the source and compares it against its own tag set, because the two
  # registers must mean the same thing by "filed" and cannot share a regex (one is shell, one is
  # JS). Byte escapes made that arm capture the wrong group and go red — caught by the full
  # suite, 2026-11-08, which is the argument for running it rather than the files you touched.
  awk '
    {
      if ($0 !~ /^- (🏃|🧭|💼|👤|⚙️) \*\*[^*]+\*\* `?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`?([^A-Z0-9-]|$)/) next
      if (match($0, /\*\* `?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+/) == 0) next
      t = substr($0, RSTART, RLENGTH)
      sub(/^\*\* `?/, "", t)
      printf "%s\t%s\n", NR, t
    }' "$1"
}

board_tag_bullet_ids() { board_tag_bullet_sites "$1" | cut -f2; }

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
heading_open_sites() {
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
        printf "%s\t%s\n", NR, substr(line, RSTART, RLENGTH); next
      }

      # `###`/`####` keep the backticked convention: it is what stops a sentence-shaped
      # heading that MENTIONS an id from being read as that id\x27s filing.
      if (line !~ /^###/) next
      if (match(line, /`[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`/) == 0) next
      printf "%s\t%s\n", NR, substr(line, RSTART + 1, RLENGTH - 2)
    }' "$1"
}

heading_open_ids() { heading_open_sites "$1" | cut -f2; }

# ── THE THIRD FILING FORMAT: A STATUS BULLET ────────────────────────────────
#
# 🔴 ADDED 2026-11-09 (`DOCS-RESIDUAL-01`, by code review). This file's own § *Keeping this
# file honest* names **three** item formats — status bullets, LATER table rows, unscheduled
# bullets — and says *"a bullet-only grep misses ~40% of open items; that is why CA-08 once
# looked like it had vanished."* The owner covered the `###` heading and the board-tag bullet
# and NOT the status bullet, so `POSTRUN-PLAN-FEEDBACK-01` — filed at L22232, cited as an open
# blocker six times — was in no set at all, and the first consumer to ask "is this id filed?"
# reported it as a typo.
#
# ⚠️ IT SHARES THE CLOSED VOCABULARY, which is the half that matters: the same
# `_CLOSED_STAMPS` / `_CLOSED_PROSE` and the same blank-the-backticks rule, so a bullet closes
# the same way a heading does and an id containing "DEAD" cannot close itself.
#
# ⚠️ IT IS DELIBERATELY NOT IN `open_item_boards` OR § 4's TAG GATE. Those populations are the
# heading + board-tag sets by ruling (`BACKLOG-TAG-IN-HEADING-01`), and widening them would
# demand a board tag from 23 bullets that never carried one. This set exists so a consumer can
# answer "is this id a live item?" without being wrong about 23 of them.
status_bullet_open_sites() {
  awk -v stamps="$_CLOSED_STAMPS" -v prose="$_CLOSED_PROSE" '
    /^- / {
      line = $0
      if (match(line, /^- ([^ A-Za-z]+ )?\*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+/) == 0) next
      if (match(line, /[A-Z][A-Z0-9]*(-[A-Z0-9]+)+/) == 0) next
      id = substr(line, RSTART, RLENGTH)
      bare = line
      gsub(/`[^`]*`/, "@@", bare)          # an id containing DEAD must not close itself
      if (index(bare, "\342\234\205") || index(bare, "~~")) next
      n = split(stamps, w, "|"); for (i = 1; i <= n; i++) if (index(bare, w[i])) next
      lo = tolower(bare)
      m = split(prose, q, "|");  for (i = 1; i <= m; i++) if (index(lo, tolower(q[i]))) next
      printf "%s\t%s\n", NR, id
    }' "$1"
}

status_bullet_open_ids() { status_bullet_open_sites "$1" | cut -f2; }



# ── WHICH BOARD OWNS EACH OPEN ITEM ─────────────────────────────────────────
#
# 🔴 THE THIRD DERIVATION TO LAND HERE (BACKLOG-TAG-IN-HEADING-01, 2026-11-08), and it was
# written twice before it was owned: `backlog-open.sh` held it, and `backlog-verify.mjs`
# needed it to GATE the filing rule. Two copies of this would disagree about which board owns
# an item, which is the one thing it exists to say.
#
# Emits `id<TAB>BOARD` for every open item. BOARD is one of COACHING · DESIGN · SLT · FOUNDER ·
# NO BOARD · `?`.
#
# TWO RULES, both measured rather than assumed:
#
# 1. ⚠️ THE WINDOW IS THE FILING LINE PLUS THE NEXT 8, stopping at the next heading. The
#    filing rule asks for the tag in the HEADING, because that is where every parse looks —
#    but 18 of 23 items measured on 2026-10-05 already stated their board in the BODY
#    (`**Tags:** 🏃 COACHING BOARD`, `**Board: ⚙️ NO BOARD**`). **The decision was made and
#    was unreadable, which is the worst of both.** Reading the block finds those; the gate in
#    `backlog-verify.mjs` is what asks for them to be moved up.
#
# 2. 🔴 THE EARLIEST GLYPH IN THE LINE WINS, NOT A FIXED TEST ORDER. The filing rule says an
#    item may carry more than one tag and must then NAME THE ORDER — and the document writes
#    the RULING board first: *"⚙️ NO BOARD to measure; 🧭 DESIGN BOARD to place it"*, *"💼 SLT
#    (tier), then 🏃 COACHING BOARD"*. A fixed order tested SLT before NO BOARD and so filed
#    `HK-NATIVE-BG-INGEST-02` under the SLT. 📐 Measured: it differs on **12 of 123 open
#    items**, and all twelve read correctly under earliest-wins. **NO BOARD 46 → 54.**
open_item_boards() {
  local bl="$1"
  # 🔴 DETERMINISTIC, AND `sort -u -k2,2` WAS NOT (code review, 2026-11-08). That compares only
  # the id and `-u` keeps an ARBITRARY one of the tied lines, so an id with two filing sites
  # could keep either — and the board, and therefore the gate's verdict, could flip between runs
  # with no change to the document. Measured latent: 0 ids currently have two sites. Now the
  # FIRST site in file order wins, always, which is also the right answer: an item's canonical
  # filing is its first, and a later restatement is the mention this function exists to ignore.
  { heading_open_sites "$bl"; board_tag_bullet_sites "$bl"; } \
  | sort -t"$(printf '\t')" -k1,1n | awk -F'\t' '!seen[$2]++' \
  | awk -F'\t' -v BL="$bl" '
      { site[$1] = $2 }
      END {
        n = 0
        while ((getline l < BL) > 0) { n++; L[n] = l }
        for (ln in site) {
          id = site[ln]; b = "?"
          for (i = ln + 0; i <= ln + 8 && i in L; i++) {
            if (i > ln + 0 && L[i] ~ /^#/) break
            # 🔴 AND IT MUST STOP AT ANOTHER ITEM'"'"'S FILING (code review, 2026-11-08). Stopping
            # only at `^#` let an untagged `###` item inherit the tag from a NEIGHBOURING board-tag
            # bullet inside the window — the mention-vs-filing class re-entering through the very
            # window added to fix it. Verified latent: none of the 6 late-tag rows reads another
            # item'"'"'s bullet. A board-tag bullet is a filing, so it ends the previous one.
            if (i > ln + 0 && L[i] ~ /^- .*\*\*.*\*\* *`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+/) break
            line = L[i]; best = 0; cand = "?"
            # ⚠️ Written out rather than looped: awk has no ordered map and the GLYPH BYTES
            # are the key fact here. Each board is tested for its position in the line, and
            # the smallest position wins — see rule 2 above.
            p = index(line, "🏃");          if (p && (best == 0 || p < best)) { best = p; cand = "COACHING" }
            p = index(line, "⚕️"); if (p && (best == 0 || p < best)) { best = p; cand = "COACHING" }
            p = index(line, "🩹");          if (p && (best == 0 || p < best)) { best = p; cand = "COACHING" }
            p = index(line, "🧭");          if (p && (best == 0 || p < best)) { best = p; cand = "DESIGN" }
            p = index(line, "💼");          if (p && (best == 0 || p < best)) { best = p; cand = "SLT" }
            p = index(line, "👤");          if (p && (best == 0 || p < best)) { best = p; cand = "FOUNDER" }
            p = index(line, "⚙️"); if (p && (best == 0 || p < best)) { best = p; cand = "NO BOARD" }
            if (cand != "?") { b = cand; printf "%s\t%s\t%s\n", id, b, i; break }
          }
          if (b == "?") printf "%s\t?\t%s\n", id, ln
        }
      }'
}
