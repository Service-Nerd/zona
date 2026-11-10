#!/usr/bin/env bash
# DOC-AUDIT-01 — "are all the documents up to date?", answered mechanically.
#
# Asked three times on 2026-09-17. Each time the answer was yes and each time
# something was stale, because the audit was run from memory and scoped to what
# the assistant remembered working on. This reads git.
#
# ⚠️ THE CONTRACTS CHECK EXISTS BECAUSE IT WAS THE CATEGORY NOBODY LOOKED AT.
# Registry, build-log, backlog, roadmap, invariants and the state blocks were all
# audited twice that day and were clean. `docs/contracts/` was never in the list,
# and two contracts (race-times, session-steps) had gone stale against the same
# day's ships. An audit is only ever as wide as its list.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
# ⚠️ `--no-advance` IS A FLAG, NOT A DATE. `push-docs-check.py` runs this on
# every `git push` and must not move the marker -- a read-only probe with a side
# effect is the thing this script's own marker comment warns about. Without this
# branch the flag was being read as `$1`, i.e. as a SINCE date, producing
# `git log --since="--no-advance 00:00"`. It happened to behave; it was luck.
NO_ADVANCE=0
if [ "${1:-}" = "--no-advance" ]; then NO_ADVANCE=1; shift; fi
SINCE="${1:-$(date +%Y-%m-%d)}"
fail=0
say() { printf '%s\n' "$*"; }

# ── THE THIRD ITEM SHAPE: A BOARD-TAG BULLET (BACKLOG-BULLET-BLIND-01) ──────
#
# 🔴 EVERY OPEN-ITEM EXTRACTOR IN THIS FILE KEYS ON A STATUS EMOJI, AND THE
# FILING RULE INTRODUCED A SECOND KIND OF MARKER THAT IS NOT ONE. Since
# 2026-09-22 every item entering the backlog carries a BOARD TAG — 🏃 / 🧭 /
# 💼 / 👤 / ⚙️ — and the `SITE-CURRENCY-FOLLOWONS-01` wave filed its items as
# plain list bullets led by that tag rather than as quoted bullets or headings.
# Measured 2026-11-06: **11 items in this shape, FIVE of them already shipped
# with feature-registry rows**, and all three backlog arms below printed `ok`
# over them, because a tag is not a status and nothing here was looking for one.
#
# ⚠️ THE COMMENT CHAIN ON THOSE ARMS RECORDS SEVEN ROUNDS OF THIS — 🔻 missing,
# 🔴 argued twice, `####` vs `###`, the emoji-optional heading, the unmarked
# heading. Each round added a marker to a list of markers. **This round is not
# another marker: it is a shape whose marker set is the FILING RULE's, and the
# rule is the document's own convention, not a list this script maintains.**
#
# ✅ is deliberately NOT in the set: it is how this shape says CLOSED, and it is
# the discriminator. That is why this arm does not grep the line's prose for
# "shipped" — a prose grep fires on an open item whose body happens to mention a
# ship, which is most of them.
# 🔴 THIS BLOCK ONCE ALSO DEFINED A `BOARD_TAG_BULLET` CONSTANT, DOCUMENTED AS
# *the* pattern and referenced NOWHERE — a second copy of the function's regex
# that could be widened with no effect while the self-test stayed green. Code
# review found it before the push. The function below is the single owner; the
# `itemXref.test.ts` cross-check reads the tag set out of ITS body, not a
# constant. Duplication in the thing built to fix a duplication, in one commit.
#
# Group 2, never "every id on the matched text" — the mistake this script
# records making on the registry extractor, where a qualifier's id read as a row
# of its own (`| SITE-WAVE-4 (SITE-SPACE-01) — …`).
# 🔴 THE TERMINATOR WAS `[ —–-]` AND `itemXref.test.ts` USED `\b`, so the two
# registers still disagreed about what ENDS an id after the commit that was
# meant to make them agree. `- ⚙️ **NO BOARD** `FOO-01`: …` is a filing to
# itemXref and was invisible to all three arms here — the same blindness, one
# punctuation mark over. Found by code review on the fix. Now: any character
# that cannot be part of an id ends it, which also stops `FOO-01-BAR` being
# truncated to `FOO-01` (`-` was IN the old set).
# ⚠️ SOURCED, NEVER COPIED — see scripts/lib/open-items.sh for why.
. "$(git rev-parse --show-toplevel)/scripts/lib/open-items.sh"

# ── The ship-record window: a MARKER, not a calendar date ───────────────────
#
# ⚠️ THIS CHECK READ "ALL CLEAN" WHILE CHECKING NOTHING, and that is why the
# window changed. It was scoped to `--since today`. At 00:00 on 2026-09-21 the
# date rolled over, the list emptied, and 2026-09-20's thirty-nine ship scopes
# stopped being covered — one of which (`§117 Am.2`) had a feature-registry row
# and no build-log entry. Found by reconciling by hand, not by this script.
#
# Third time in two days that a date-scoped list expired and took its coverage
# with it (`BACKLOG-STALE-ALLTIME-01` was the same shape: eleven shipped items
# sat open because the backlog check also stopped at midnight). **A date-scoped
# list is a list that empties on its own.**
#
# So the window is now a commit marker that only advances when the check is
# CLEAN. A gap stays in scope until it is fixed, and nothing falls out of scope
# because the clock moved.
MARKER_FILE=".claude/state/last-doc-audit.txt"
MARKER="$(cat "$MARKER_FILE" 2>/dev/null | tr -d '[:space:]')"
if [ -n "${1:-}" ]; then RANGE_DESC="since $SINCE"; RANGE_ARGS=(--since="$SINCE 00:00")
elif [ -n "$MARKER" ] && git cat-file -e "$MARKER^{commit}" 2>/dev/null; then
  RANGE_DESC="since $MARKER"; RANGE_ARGS=("$MARKER..HEAD")
else
  RANGE_DESC="since $SINCE (no marker yet)"; RANGE_ARGS=(--since="$SINCE 00:00")
fi

say "── ship records (feat/fix/perf scopes $RANGE_DESC) ──"
# ⚠️ THE SCOPE PATTERN IS DELIBERATELY LOOSE. It used to be `[A-Z0-9-]+`, which
# could not see `feat(§117 Am.2)` at all — nor `COMPLIANCE-FIX-2/3`,
# `FIRSTRUN-MOMENTS-01a`, `ADR-015/016` or any lowercase scope. Measured across
# all history: **270 of 508 scopes (53%) were invisible to it.** A check that
# silently skips half its population is worse than one that is absent, because
# it reports ok.
# ⚠️ A TRAILING PROSE SUFFIX IS STRIPPED, AND ONLY THAT. `fix(COPY-VOICE-01 et
# al)` made this check hunt for a feature literally called "COPY-VOICE-01 et
# al" while the records sat under the real id. The temptation was to accept
# only ID-SHAPED tokens, and that is exactly the narrowing the note above
# records as having hidden 53% of all scopes. So the pattern stays loose and
# one specific suffix comes off. A commit scope should still be a bare id; this
# stops a formatting slip becoming a permanent false gap, it does not bless it.
ids=$(git log "${RANGE_ARGS[@]}" --pretty=format:"%s" \
      | grep -oE "^(feat|fix|perf)\([^)]+\)" | sed -E 's/^(feat|fix|perf)\(//; s/\)$//' \
      | tr ',' '\n' | sed -E 's/^ +| +$//g' \
      | sed -E 's/[[:space:]]+(et al|etc\.?|and others)$//I' \
      | sed -E 's/^ +| +$//g' | grep -v '^$' | sort -u)
# ⚠️ LINE-WISE, NOT `for id in $ids`. A word-splitting loop turned the scope
# `§117 Am.2` into two ids (`§117` and `Am.2`) and reported a gap against a
# fragment that was never a scope. Caught by falsifying this very check.
while IFS= read -r id; do
  [ -z "$id" ] && continue
  r=$(grep -cF "| $id " docs/canonical/feature-registry.md || true)
  b=$(grep -cF -- "$id" <(grep '^## ' docs/build-log.md) || true)
  if [ "$r" = "0" ] || [ "$b" = "0" ]; then say "  GAP $id registry=$r buildlog=$b"; fail=1; rfail=1; fi
done <<< "$ids"
[ "${rfail:-0}" = "0" ] && say "  ok"

# ── SHIP-RECORD-ALLTIME-01 ─────────────────────────────────────────────────
#
# ⚠️ THE CHECK ABOVE STOPS CHECKING THE MOMENT IT PASSES, AND THAT IS NOT A
# THEORY. It runs over commits SINCE the marker in
# `.claude/state/last-doc-audit.txt`, and a clean run ADVANCES that marker. So
# the second run inspects zero commits and prints `ok`. Falsified on
# 2026-09-21 by deleting the SITE-TYPE-01 registry row an hour after it was
# added: the audit read ALL CLEAN.
#
# This is the identical weakness `BACKLOG-STALE-ALLTIME-01` was written to
# close on the backlog check, one section below, and the same reasoning
# applies: an incremental check is a tripwire, not an inventory.
#
# ⚠️ A COUNT, NOT A LIST, BECAUSE THE DEBT IS REAL AND LARGE. Measured
# 2026-09-21: 291 of 454 all-time scopes lack a registry row, a build-log
# heading, or both. Most predate the discipline. Failing the build on those
# would make the whole audit unrunnable, which is how a check gets deleted.
# So the baseline is stated and only GROWTH fails. Same debt-register pattern
# as SWEEP-BASELINE-01 and the liveness baseline, and the same caveat: a
# declared reason is not a fixed problem, and nothing here schedules the debt.
#
# ⚠️ RE-BASELINED TO 0 ON A FALSE PREMISE (2026-09-30, `3e949ada`), AND
# RESTORED TO THE MEASURED FIGURE (2026-10-02). That commit read:
#
#   "✅ CLEARED AND RE-BASELINED TO 0. The debt reached 0 — every all-time
#    feat/fix/perf scope now has both a registry row and a build-log heading"
#
# The slack it set out to close was real — 291 against a baseline of 291 printed
# "improved, lower the baseline" on every run, so a ship could have lost its
# records 291 times and this check would still have said green. But **the debt
# had not been paid.** Measured at that commit's parent with the matching logic
# unchanged: 288. The register was ratcheted to 0 while the objects were still
# undocumented, so the next run reported "GREW: 291 — a ship lost its records"
# about a frozen historical tail, which is the wrong story told loudly.
#
# 🔴 ITS FALSIFICATION COULD NOT CATCH THIS, AND LOOKED RIGOROUS. The commit
# records setting the baseline to -1 "against an actual 0", getting GREW, and
# calling that proof. Against -1 an actual 288 reports GREW *identically*: the
# mutation passes the same whether the premise holds or not. **A falsification
# that cannot distinguish the claim from its negation is not evidence** — the
# recorded class is "the weak mutation, not the weak arm".
#
# ⚠️ 291 IS A COUNT, NOT A VERDICT ON 291 ITEMS. Reconciled 2026-10-02 against
# this script's own arm: 135 lack a registry row only, 4 lack a build-log
# heading only, 152 lack both — union 291, of 661 all-time scopes. It was also
# 291 on 2026-09-21 when the denominator was 454, so the tail is frozen and
# every scope since has been documented. Some entries are not features in the
# registry's sense at all (`ADR-015/016`, `B-001`, `BRAND-08-pwa`), so paying
# this down starts with triage, not with writing 291 rows.
#
# Falsified on restore: 290 reports GREW and fails; 292 reports "improved";
# 291 reports "unchanged". The ratchet only ever moves down, in the same commit
# that pays the debt.
SHIP_RECORD_DEBT_BASELINE=290   # 291 -> 290, 2026-11-08: no ship was recorded; the _reg parse got WIDER (DOC-AUDIT-REG-FORMAT-01 fixed two hyphen-separator rows), so one more id is now visible as having its row. A register asking to be LOWERED because it re-counted is the only direction it may move on its own.
say "── ship records: ALL-TIME debt (baseline ${SHIP_RECORD_DEBT_BASELINE}) ──"
all_ids=$(git log --pretty=format:"%s" \
      | grep -oE "^(feat|fix|perf)\([^)]+\)" | sed -E 's/^(feat|fix|perf)\(//; s/\)$//' \
      | tr ',' '\n' | sed -E 's/^ +| +$//g' \
      | sed -E 's/[[:space:]]+(et al|etc\.?|and others)$//I' \
      | sed -E 's/^ +| +$//g' | grep -v '^$' | sort -u)
debt=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  r=$(grep -cF "| $id " docs/canonical/feature-registry.md || true)
  b=$(grep -cF -- "$id" <(grep '^## ' docs/build-log.md) || true)
  if [ "$r" = "0" ] || [ "$b" = "0" ]; then debt=$((debt+1)); fi
done <<< "$all_ids"
if [ "$debt" -gt "$SHIP_RECORD_DEBT_BASELINE" ]; then
  say "  GREW: $debt undocumented scopes, baseline $SHIP_RECORD_DEBT_BASELINE. A ship lost its records."
  fail=1
elif [ "$debt" -lt "$SHIP_RECORD_DEBT_BASELINE" ]; then
  say "  $debt (improved from $SHIP_RECORD_DEBT_BASELINE — lower the baseline in this script)"
else
  say "  $debt, unchanged"
fi

# ── ITEM-SHAPE SELF-TEST (BACKLOG-BULLET-BLIND-01) ───────────────────
#
# ⚠️ EVERY OTHER ARM HERE MEASURES THE LIVE FILE, AND A LIVE COUNT CANNOT PROVE A
# PATTERN. The recorded failures in this script are all one shape: a pattern that
# matched nothing, over a population that happened to be empty or that nobody had
# counted, reporting `ok`. A floor on the live count is no answer either — it
# empties on its own as the items close, which is the `BACKLOG-STALE-ALLTIME-01`
# mistake pointing the other way.
#
# So this runs the extractor against FIXTURES, both directions. It is independent
# of what the backlog currently holds, so it cannot rot, and narrowing the pattern
# turns it red whatever the file says.
#
# ⚠️ IT COVERS THE BOARD-TAG BULLET ONLY. The quoted-bullet and heading shapes are
# still written inline in two blocks below, twice each, with different marker sets —
# so they have no self-test and a second copy of their patterns here would be the
# flaw this repo records as "the test asserted its own copy". Factoring those four
# extractors into functions is the prerequisite and is NOT done.
say "── item-shape self-test (board-tag bullet) ──"
_fx="$(mktemp)"
cat > "$_fx" <<'FIXTURE'
- ⚙️ **NO BOARD** `SELFTEST-A-01` — a tooling item.
- 🧭 **DESIGN BOARD — RULED SHIP** `SELFTEST-B-01` — a tag may carry a qualifier.
- 🏃 **COACHING BOARD** `SELFTEST-C-01` — prescription.
- 💼 **SLT** `SELFTEST-D-01` — the price.
- 👤 **FOUNDER** `SELFTEST-E-01` — the words.
- ✅ **SHIPPED 2026-11-05** `SELFTEST-CLOSED-01` — closed, and ✅ is the discriminator.
- `some_table` — narrative prose naming `SELFTEST-PROSE-01` mid-sentence.
> 🔲 **`SELFTEST-QUOTED-01`** — another shape's business. *(P2, filed 2026-11-06)*
### 🔻 `SELFTEST-HEADING-01` — another shape's business.
FIXTURE
_want='SELFTEST-A-01 SELFTEST-B-01 SELFTEST-C-01 SELFTEST-D-01 SELFTEST-E-01'
# 🔴 THE FIXTURE MUST EXIST BEFORE ITS EMPTINESS MEANS ANYTHING. There is no
# `set -e` here, so a failed `mktemp` or an unwritten heredoc yields an empty
# `_got`, which the comparison below reports as "THE EXTRACTOR IS WRONG" —
# absence written as a value, inside the gate built to catch that. Code review
# found it. 9 fixture lines: 5 that must match, 4 that must not.
_fxn=$(wc -l < "$_fx" 2>/dev/null | tr -d ' ')
if [ "${_fxn:-0}" != "9" ]; then
  say "  THE SELF-TEST FIXTURE DID NOT MATERIALISE (${_fxn:-0} lines, want 9) — the"
  say "            extractor was NOT exercised. This is a harness failure, not a"
  say "            finding about the pattern."
  fail=1
  rm -f "$_fx"
  _fx=''
fi
_got="$(board_tag_bullet_ids "$_fx" 2>/dev/null | sort | tr '\n' ' ' | sed -E 's/ $//')"
_wantsorted="$(printf '%s\n' $_want | sort | tr '\n' ' ' | sed -E 's/ $//')"
if [ -n "$_fx" ] && [ "$_got" != "$_wantsorted" ]; then
  say "  THE BOARD-TAG BULLET EXTRACTOR IS WRONG."
  say "            want: $_wantsorted"
  say "            got:  $_got"
  say "            Five tags must match, ✅ and the other two shapes must not."
  fail=1
elif [ -n "$_fx" ]; then
  say "  ok (5 tags matched, 4 non-items rejected)"
fi
[ -n "$_fx" ] && rm -f "$_fx"

# ── BACKLOG STATUS vs what actually shipped ─────────────────────────────────
#
# Added 2026-09-20 because this script reported ALL CLEAN while FOUR items
# shipped that same day still carried an open marker in backlog.md:
# ENRICH-PII-MINIMISE-01, P-01, P-03, REFRAME-NOTE-LOSS-01.
#
# The ship-records check above proves an ID gained a registry row and a
# build-log entry. It says nothing about the BENCH — and the bench is the
# document a human reads to decide what to work on next, so a shipped item
# still marked open is the one staleness that actually misleads someone.
#
# This is the script's own stated weakness a second time: "an audit is only
# ever as wide as its list." The contracts check was added for exactly this
# reason on 2026-09-18, and backlog STATUS was still not on the list.
#
# An ID absent from backlog.md is NOT a gap — filed-and-shipped-same-day items
# never reach the bench, and demanding a row for them would cry wolf.
say "── backlog status: shipped items still marked open ──"
bfail=0
for id in $ids; do
  # 🟡 is DELIBERATELY excluded. It means "code shipped, item still open" —
  # P-16 ships §116 behind a flag with four halves explicitly unbuilt, which is
  # a legitimate state and not staleness. Flagging it would make this check
  # fire on correct work, and a guard that fires on correct work gets switched
  # off, which this repo has recorded as equivalent to having no guard.
  # ⚠️ The `.*\*\(` provenance requirement is NOT optional, and this check was
  # missing it while its sibling below already had it. An open item header
  # carries a *(P2, filed …)* block; an in-item EMPHASIS BULLET inside a quoted
  # ruling does not. Without the discriminator this fired on
  #   > 🔴 **W-03 and W-04 are effectively ONE item.** …
  # which is narrative inside an SLT ruling, and reported a killed item as open.
  # CLAUDE.md already records that exact failure for the sibling check ("this
  # fires on narrative text, which is how four separate parses of this file
  # produced four different counts") — the note was there and only half the
  # script obeyed it.
  if grep -qE "^> (🔲|🔴|🔵|⏸️) \*\*${id}[ —].*\*\(" docs/releases/backlog.md; then
    say "  STILL OPEN $id (shipped today, backlog says otherwise)"; bfail=1; fail=1
  fi
  # 🔴 AND THE HEADING FORM, WHICH THIS ARM COULD NOT SEE AT ALL UNTIL 2026-10-07.
  # The pattern above anchors `^> ` — a QUOTED BULLET. Measured the night it was
  # found: 118 open items use that form and **34 use a `### <status> \`ID\`` heading**,
  # so the arm was blind to 22% of the file by construction. Both items it missed
  # that night (ANALYSIS-SUPERSEDE-PATTERN-01, PLAN-NOTE-BUDGET-INERT-01) shipped,
  # got registry rows, and kept open headings while this printed "ok".
  # ⚠️ The status set is WIDER here on purpose. ⚖️/🧭 mean "ruled, build
  # outstanding", which is a legitimate open state in general — but this arm is
  # scoped to TODAY'S SHIP SCOPES, so for an item that shipped today it is stale
  # by construction. 🟡 stays excluded for the same reason as above.
  # The `\*\(` provenance discriminator is kept: a heading carries *(filed …, P2)*.
  # 🔴 🔻 WAS MISSING FROM BOTH ARMS AND IT IS THE MOST COMMON OPEN MARKER IN
  # THE FILE (2026-10-10). Measured: 14 `###`/`####` headings use 🔻 against 10
  # for 🟡, 6 for 🔴 and one each for 🟠/🧭. Every one means OPEN — none is a
  # kill, unlike 🔴 in this form. `WEEKTHEME-PROP-DEAD-01` shipped with a
  # registry row and kept a 🔻 heading, and BOTH arms printed ok, which is how a
  # shipped item reached an answer to "what is still open?".
  # ⚠️ AND THE `*(` PROVENANCE DISCRIMINATOR IS DROPPED HERE, DELIBERATELY. It
  # exists to stop the `^> ` bullet arm firing on NARRATIVE inside a quoted
  # ruling. A `### <marker> \`ID\` —` line cannot be narrative: it is an item
  # heading by construction. Measured, it was suppressing 5 of 10 🔻 headings and
  # 4 of 6 🔴 ones — so the discriminator was doing more hiding than
  # disambiguating on this arm. The bullet arm above keeps it.
  if grep -qE "^#{3,4} (🔻|🔲|🔴|🔵|⏸️|🟠|🧭|⚖️) \`${id}\`[ —]" docs/releases/backlog.md; then
    say "  STILL OPEN $id (shipped today, backlog HEADING says otherwise)"; bfail=1; fail=1
  fi
  # 🔴 AND THE BOARD-TAG BULLET, THE THIRD SHAPE — see the note at the top of
  # this file. A tag is not a status, so neither arm above could see it.
  if board_tag_bullet_ids docs/releases/backlog.md | grep -qxF "$id"; then
    say "  STILL OPEN $id (shipped today, backlog BOARD-TAG BULLET says otherwise)"; bfail=1; fail=1
  fi
done
[ "$bfail" = "0" ] && say "  ok"

# ── backlog status: ALL-TIME, not just today ────────────────────────────────
#
# ⚠️ THE CHECK ABOVE IS SCOPED TO TODAY'S SHIP SCOPES, AND THAT IS WHY IT SAID
# ALL CLEAN WHILE ELEVEN SHIPPED ITEMS SAT OPEN. Measured 2026-09-20: the
# founder said *"I'm sure you keep showing me things we have answered today or
# closed off"*, and he was right — `MARATHON-VOLUME-GATE-01`, `REFUSAL-SCREEN-01`,
# `LONGEST-RUN-GATE-01` and `WIZARD-TIME-CHIPS-01` shipped on 2026-09-18 and
# `MAINT-LIVENESS-01`, `INV-MSG-ROUNDING-01`, `STEPBACK-STALE-PEAK-01` and
# `GRID-MARATHON-CAPABLE-01` on 2026-09-19. Every one had a ship commit AND a
# feature-registry row, and every one still read open two days later, because
# the only check that could see them expired at midnight.
#
# An audit is only ever as wide as its list, and "since midnight" is a list.
# This one reads every open header against the WHOLE git history.
say "── backlog status: shipped ANY day, still marked open ──"
afail=0
# Registry FIRST CELL only — an ID inside another row's prose is not a shipped
# row. Same rule `ship-record-check.py` encodes, and the same mistake a plain
# grep has already made twice in this repo (GTM-CHARITY-02, and again on
# 2026-09-20 when 27 false positives read as closed).
# 🔴 THE FEATURE REGISTRY HAS TWO ROW FORMATS AND THIS READ ONLY ONE (2026-09-29).
# `| ID — description |` matched; `| ID | FREE | date | ... |` did NOT, and 68 rows use it,
# including every BACK-ARROW-FLOAT-*, ME-DOORS-01 and the whole recent wave. So `_reg` was
# short by a fifth of the register, and the two checks built on it — "a shipped item must not
# still be open" and the skip in the open-items arm — were BLIND to those IDs. They only ever
# looked clean because a recent ID is usually mentioned somewhere in roadmap prose as well.
# Same class as CONTRACT-COVERAGE-02: the arm reported ok BY NOT LOOKING. Both separators
# now, and the ID must still be the row's FIRST CELL.
# 🔴 THIRD FORMAT PROBLEM WITH THIS EXTRACTOR, AND IT HID EXACTLY WHAT THE ARM BELOW EXISTS
# TO FIND (2026-10-02). A first cell may carry a PARENTHETICAL QUALIFIER — `| TAP-TARGET-
# DECISIONS-01 (part 1) |`, `(part 2)`, `| DASHBOARD-SCREEN-EXTRACT-01 (phase 1) |`,
# `| MICRO-LABEL-DRIFT-01 (vocabulary) |` — and the pattern demanded the id be followed
# IMMEDIATELY by `|`, `—` or `/`. **Measured: 4 of 399 rows, small; but all THREE distinct ids
# read as shipped-AND-open, which is 100% of the thing this arm is for.** A multi-part ship is
# precisely the kind that stays half-open, so the rows most likely to need the check were the
# rows it could not see. The qualifier is now optional; the id must still be the FIRST CELL,
# so an id inside another row's prose is still rejected — that rule was bought twice
# (GTM-CHARITY-02, and 27 false positives on 2026-09-20) and is not relaxed here.
# ⚠️ AND IT CAPTURES GROUP 1, NOT "every id on the matched text". The two-grep form
# (`grep -oE <row> | grep -oE <id>`) pulls ids out of the QUALIFIER too: `| SITE-WAVE-4
# (SITE-SPACE-01) — …` would have registered **SITE-SPACE-01** as having its own row when it
# is only named inside another's. That is the `GTM-CHARITY-02` mistake exactly, re-created by
# the fix for a different one — caught by diffing the accepted set before trusting it.
# 🔴 THE QUALIFIER RUN, NOT ONE QUALIFIER (2026-11-07, BACKLOG-STATUS-GLYPH-BLIND-01).
# This allowed exactly ONE `(...)` before the separator, and the registry writes runs:
# `| STEPPER-CONTROL-01 (b)+(c) — ...`. So that row never entered `_reg`, the item sat open
# with its arms shipped, and the arm below could not say so. ⚠️ **Blind on BOTH sides at
# once**, which is the same shape this script already records for DASHBOARD-SCREEN-EXTRACT-01:
# the heading arm could not see the glyph AND the registry arm could not see the qualifier,
# so fixing either alone changed nothing observable.
# 🔴 THE QUALIFIER SLOT IS FREE TEXT, NOT A BRACKET (third hole, same session). Rows read
# `| SESSION-SLOTS-01 Phases 0-2 — ...` and `| STEPPER-CONTROL-01 (b)+(c) — ...`: one
# unbracketed, one a bracket RUN. The pattern accepted exactly one `(...)` or an immediate
# em dash, so BOTH were absent from `_reg` and both items sat open with their work shipped.
# ⚠️ It is bounded by `[^|—]` so it cannot leave the first cell, and only the FIRST id is
# captured — which is what the 2026-10 comment above was protecting when it tightened this
# and accidentally made it too tight.
sed -nE 's/^\| *`?([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)`?[^|—]{0,60}[—|].*/\1/p' \
  docs/canonical/feature-registry.md | sort -u > /tmp/_reg

# ── 🔴 THE PARSE MUST PROVE IT READ EVERY ROW (DOC-AUDIT-REG-FORMAT-01, 2026-11-08) ──
#
# The pattern above has been widened FOUR times, each time by someone finding a row it could
# not see: the pipe separator (68 rows), a parenthetical qualifier (`(part 1)`), a qualifier
# RUN (`(b)+(c)`), and free text before the dash (`Phases 0-2`). Every one of those was found
# BY HAND, after an item had sat open with its work shipped, because a parse that misses a row
# fails SILENTLY — a missing id looks exactly like an id that was never registered.
#
# ⚠️ THE ITEM ASKED FOR THE DOCUMENT TO BE NORMALISED TO ONE ROW FORMAT, AND RE-MEASURING
# 2026-11-08 SAYS THAT IS THE WRONG FIX. There is one table shape here, not two: every row is
# `| first-cell | tier | date | description |`. The only variance is whether the first cell
# carries a TITLE after the id (576 rows do, 155 do not). "Normalising" would mean deleting 576
# titles or inventing 155, which destroys information and improves no check.
#
# **The hazard was never the two forms. It was that a FIFTH form could appear and nothing would
# say so.** So instead: every row whose first cell STARTS with an id must yield that id. A
# shape the pattern cannot read now fails here, loudly, naming the row.
#
# 📐 It found one on the way in: `| ENVELOPE-BASELINE-01 - the fit-for-purpose rate ... |` and
# `| M4-NOT-A-REFUSAL-01 - a persona ... |` use a HYPHEN-MINUS where the register uses an em
# dash, so `[—|]` never matched and both rows were outside `_reg`. Latent — neither item was
# still open — which is exactly how the previous four got in.
# ⚠️ ROWS AND IDS ARE DIFFERENT NUMBERS AND THE FIRST CUT OF THIS LINE CONFLATED THEM
# (code review, 2026-11-08). It printed "reads all N leading-id rows" from a `sort -u` list,
# which is a count of IDS: 805 unique ids across **848** such rows, because 20 ids carry more
# than one row (multi-part ships). Both figures are meaningful and neither is the other, so
# both are printed. ⚠️ The 576/155 title split quoted in CLAUDE.md is a third population —
# rows whose first cell is followed by an em dash or a pipe, 731 of the 848 — and the
# remaining 117 are the continuation and header rows this arm's own pattern skips.
sed -nE 's/^\| *`?([A-Z][A-Z0-9]*(-[A-Z0-9]+)+)`?.*/\1/p' \
  docs/canonical/feature-registry.md > /tmp/_regleading_rows
sort -u /tmp/_regleading_rows > /tmp/_regleading
_regmissed=$(comm -13 /tmp/_reg /tmp/_regleading)
_regfail=0
if [ -n "$_regmissed" ]; then
  say "  ✗ THE REGISTRY HAS A ROW FORMAT \`_reg\` CANNOT READ — every open-item arm is blind to these ids:"
  _regfail=1; fail=1
  for id in $_regmissed; do
    say "    ✗ $id"
    grep -nE "^\| *.?$id" docs/canonical/feature-registry.md | head -1 | cut -c1-120 | sed 's/^/        /'
  done
  say "    Widen the \`_reg\` pattern in scripts/audit-docs.sh, or normalise the row."
fi
[ "$_regfail" = "0" ] && say "  registry parse reads every leading-id row: $(wc -l < /tmp/_regleading_rows | tr -d ' ') rows, $(wc -l < /tmp/_regleading | tr -d ' ') distinct ids"
# Open headers carry a *(provenance)* block; in-item emphasis bullets do not.
# Without that discriminator this fires on narrative text, which is how four
# separate parses of this file produced four different counts.
{
  grep -oE '^> (🔲|🔴|🔴🔴|🔵|⏸️|⚠️) \*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`?[ —–-].*\*\(' docs/releases/backlog.md \
      | grep -oE '\*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
  # ⚠️ SECOND HEADER SHAPE, added 2026-09-21. The quoted-bullet form above is
  # the convention; the W-series was filed as `### 🟡 `W-07` — ...` instead.
  # This parse could not see that shape AT ALL, so FIVE shipped items sat in
  # the backlog still reading as open problem statements ("the band
  # alternation is muddy", "our page does not CLOSE") while their registry
  # rows said shipped. Found by hand, not by this script.
  #
  # FOURTH time in two days that "an audit is only ever as wide as its list"
  # has bitten, and the lesson has stopped being about any one list: a checker
  # that encodes ONE way of writing something is blind to every other way, and
  # people write things more than one way.
  # ⚠️ 🔴 IS EXCLUDED HERE AND INCLUDED ABOVE, ON PURPOSE. The two header
  # shapes carry different marker semantics: in the quoted-bullet form 🔴
  # means an open item at high priority, and in the `###` form it means KILLED
  # or WITHDRAWN. Treating them alike reported W-06 (withdrawn) and W-11
  # (killed) as open. The inconsistency is in the document, not the check, and
  # normalising the document is the better fix — recorded so whoever does that
  # knows this clause exists.
  # ⚠️ `###` AND `####`, 2026-10-02. This matched three hashes exactly, and three open
  # headings use four — among them `DASHBOARD-SCREEN-EXTRACT-01` and `-02`, BOTH of which
  # carry registry rows. So the shipped-but-open arm was blind on BOTH SIDES at once: the
  # registry extractor could not see a qualified first cell, and this could not see a `####`
  # heading. Fixing either alone changes nothing observable, which is why the gap survived.
  # ⚠️ ⚖️ AND 🧭 ADDED 2026-10-07. Both mean "a board RULED, build outstanding" and
  # neither has a killed meaning in either header shape, so they are safe to include where
  # 🔴 is not. `ANALYSIS-SUPERSEDE-PATTERN-01` sat as `### ⚖️` with a registry row dated the
  # same day and BOTH backlog arms printed ok — the today-scoped one anchors `^> ` and could
  # not see a heading at all, and this one saw headings but not that marker. **Two arms, one
  # blind spot each, in opposite places.**
  # 🔴 STILL EXCLUDED, AND THE DOCUMENT IS THE REASON. In the `###` form 🔴 means KILLED,
  # so adding it would report every withdrawn item as open (W-06, W-11 — recorded above).
  # But `PLAN-NOTE-BUDGET-INERT-01` was filed `### 🔴` meaning *open at P1*, which violates
  # that convention, shipped, and stayed open past its ship day invisible to both arms.
  # The today-scoped arm now catches that case, because within a range of items that
  # DEMONSTRABLY SHIPPED, "🔴 means killed" cannot apply. Normalising the document is still
  # the better fix and is still not done.
  # 🔴 🔻 ADDED 2026-10-10 — see the note on the today-scoped arm. It is the
  # most common open marker in the file (14 headings) and was absent from BOTH
  # arms, so between them they could not see the dominant way an open item is
  # written. Safe to include where 🔴 is not: 🔻 has no killed meaning in either
  # header shape, checked across all 14.
  # ⚠️ BOTH GREPS THAT USED TO LIVE HERE ARE SUPERSEDED BY `heading_open_ids`
  # (BACKLOG-STATUS-GLYPH-BLIND-01, 2026-11-07 — see the vocabulary block near the top).
  # The comment history above is kept deliberately: it records seven separate occasions on
  # which a MISSING GLYPH made this arm blind, and three on which this script said the real
  # fix was to stop keying on glyphs. The eighth occasion is what finally did it.
  heading_open_ids docs/releases/backlog.md
  # The board-tag bullet (BACKLOG-BULLET-BLIND-01). FIVE shipped items sat open
  # in this shape while this arm printed ok.
  board_tag_bullet_ids docs/releases/backlog.md
} | sort -u > /tmp/_open
# ⚠️ DECLARED EXEMPTIONS — an ID that is legitimately BOTH shipped and open, each with its
# reason. Added 2026-09-29, when widening `_reg` to the registry's second row format
# surfaced the first real instance. This is a register, not a silencer: an entry with no
# reason beside it is the thing it exists to prevent.
# 🔴 AND AN EXEMPTION THAT OUTLIVES ITS REASON IS A SILENCER. The note above guarded
# against an entry with NO reason; it said nothing about an entry whose reason has since
# become FALSE, which is the same failure one step later.
#   ZONES-SURFACE-01 was exempted 2026-09-29 because "the RULINGS shipped and carry a
#   registry row; the BUILD was re-specified afterwards" — two objects under one ID. The
#   build then SHIPPED (`components/shared/TrainingZonesScreen.tsx`, plus
#   `ZONES-ZONE-SHEET-GONE-01`, `ZONES-HR-SHEET-01` and `ME-BENCHMARK-DUP-01` on top of
#   it), including the PREFERRED half of the open decision — the band derivation lives in
#   `lib/plan/paceBands.ts` and the screen reads the `PaceGuide` the engine built rather
#   than recomputing it. Nobody came back to the exemption, so for days the arm was
#   silenced on an ID that was simply stale-open. Entry removed 2026-10-02.
#   NO-RUNNER-TURNED-AWAY-01 (2026-10-24): Phase B SHIPPED (staged plan built dark; the base-build checkpoint
#   measured on the server, live) with its registry row, and the ITEM stays open: staged plans measured 5.7% clean
#   (§29's discount, §113's long run), so the Coaching Board rules again before the flag may turn on, then phases
#   C (screens), D (walk-run start) and E (the after-round). Removed 2026-10-25: the item closed when it was switched on.
# Checked below in BOTH directions.
#   ── Declared 2026-11-07, when BACKLOG-STATUS-GLYPH-BLIND-01 made these four visible for the
#   first time. Each is genuinely BOTH, each names what would end the exemption.
#   READINESS-SURFACE-01: the Design Board ruled SHIP WITH AMENDMENT and the SLT ruled BUILD;
#     part is in the registry and the amendment's build is outstanding. Remove when the
#     amendment ships.
#   STRENGTH-ENGINE-01: a programme, not an item (ADR-024). Phases have shipped and have rows;
#     the engine is a side project with phases open. Remove when the last phase ships.
#   STEPPER-CONTROL-01: arms (a)(b)(c) shipped with a `(b)+(c)` registry row; arm (d) is
#     BLOCKED ON A DEVICE and only the founder can unblock it. Remove when (d) lands.
#   TODAY-CTA-CLEARANCE-01: shipped, then REVERTED, then re-opened; BLOCKED ON A DEVICE.
#     Remove when the re-fix lands or the item is killed.
# ⚠️ ALL FOUR SHOULD SHRINK, AND THE SCRIPT CANNOT TELL YOU IF THEY DO NOT. Per this repo's
# own rule, a register's reason column is not a fixed problem: if one of these is still here
# in a month, that is the finding.
#   NATIVE-BATCH-01 (2026-11-07): a STANDING PROCEDURE, not an item — "run on EVERY native
#     submission". Its registry row records the sweep that produced the checklist; the checklist
#     itself is a living document and never closes. Remove only if the procedure is retired.
#   CONTRACT-COVERAGE-03 (2026-11-08): a FALLING REGISTER, not a finite item. Its own text says
#     so — "contract one and lower `UNCONTRACTED_BASELINE` in the same commit" — so every
#     payment earns a registry row while the item stays open at a lower number. W4 paid
#     56 → 50 with six contracts. ⚠️ **Remove this exemption when the figure reaches 0, OR if a
#     month passes with no payment** — per this file's own rule, a reason column is not a fixed
#     problem, and a falling register that stops falling is just debt with a comment on it.
_SHIPPED_AND_OPEN_OK='READINESS-SURFACE-01 STRENGTH-ENGINE-01 STEPPER-CONTROL-01 TODAY-CTA-CLEARANCE-01 NATIVE-BATCH-01 CONTRACT-COVERAGE-03'
for id in $(comm -12 /tmp/_reg /tmp/_open); do
  case " $_SHIPPED_AND_OPEN_OK " in *" $id "*) continue ;; esac
  say "  STILL OPEN $id (has a feature-registry row)"; afail=1; fail=1
done
# The inverse: an exemption for an ID that is no longer both shipped AND open has done its
# job and must go, exactly as `configPrincipleSync` fails on a stale baseline row. Without
# this the list can only ever grow, and a register that only grows is one nobody trusts.
for id in $_SHIPPED_AND_OPEN_OK; do
  if ! comm -12 /tmp/_reg /tmp/_open | grep -qx "$id"; then
    say "  STALE EXEMPTION $id is no longer both shipped and open — delete it from _SHIPPED_AND_OPEN_OK"
    afail=1; fail=1
  fi
done
[ "$afail" = "0" ] && say "  ok"

# ── REGISTRY ROW WITH NO BUILD-LOG ENTRY (REG-BUILDLOG-01, 2026-10-14) ───────
# 🔴 THIS SCRIPT SAID "ALL CLEAN" OVER A REAL GAP AND WAS NOT WRONG — IT WAS BLIND.
# Both existing build-log checks loop over COMMIT SCOPES, so they only ever ask
# "did the thing I shipped get recorded?". `DOC-TOKEN-DRIFT-01` shipped INSIDE
# another commit, earned its own registry row, and was never anybody's scope — so
# no arm here could see that it had no build-log entry. Found by reconciling the
# two registers by hand after the audit had already passed, which is the third
# time "an audit is only ever as wide as its list" has bitten this file.
#
# This walks the OTHER register: every ID in a registry row's first cell must have
# a `##` heading in the build-log.
#
# ⚠️ A DEBT REGISTER, NOT A DEMAND. Measured when written: 597 registry rows carry
# a leading ID and **37** have no build-log heading. Many are legitimate — an item
# that shipped as part of a larger build (the BUTTON-GEOMETRY trio say so in their
# own rows). Demanding zero would fire 37 times on day one and be deleted, which
# this repo has recorded twice as equivalent to having no check. The count may only
# FALL; anything new fails.
say "── registry rows with no build-log entry ──"
rfail3=0
grep '^## ' docs/build-log.md > /tmp/_blheads
grep -oE '^\|[[:space:]]*[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' docs/canonical/feature-registry.md \
  | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | sort -u > /tmp/_regids
_nobl=0
while read -r id; do
  [ -z "$id" ] && continue
  grep -qF -- "$id" /tmp/_blheads || _nobl=$((_nobl + 1))
done < /tmp/_regids
REG_NO_BUILDLOG_BASELINE=37
if [ "$_nobl" -gt "$REG_NO_BUILDLOG_BASELINE" ]; then
  say "  A REGISTRY ROW GAINED NO BUILD-LOG ENTRY ($_nobl vs $REG_NO_BUILDLOG_BASELINE)."
  say "            Every shipped item earns a '##' heading in docs/build-log.md, including"
  say "            one that shipped inside another commit. Run /ship."
  rfail3=1; fail=1
elif [ "$_nobl" -lt "$REG_NO_BUILDLOG_BASELINE" ]; then
  say "  DEBT PAID: $_nobl vs $REG_NO_BUILDLOG_BASELINE — lower REG_NO_BUILDLOG_BASELINE in this script."
  rfail3=1; fail=1
fi
# The population must be real: an empty or collapsed id list passes in silence.
_regn=$(wc -l < /tmp/_regids | tr -d ' ')
if [ "$_regn" -lt 400 ]; then
  say "  THE REGISTRY ID SCAN COLLAPSED ($_regn ids) — re-anchor it before trusting this arm."
  rfail3=1; fail=1
fi
[ "$rfail3" = "0" ] && say "  ok ($_regn registry ids, $_nobl without a build-log entry — declared debt)"

say "── open backlog items with no roadmap line ──"
# CLAUDE.md's doc system: "An open item lives in roadmap (as a line) + backlog
# (as detail)." Nothing checked the roadmap half. Found 2026-09-21 by the peer
# session working on MKT-PLAN-SHAPE-01: all three items it filed that morning
# were in backlog only, and this script read ALL CLEAN over them.
#
# ⚠️ THIRD TIME IN TWO DAYS that "an audit is only ever as wide as its list"
# has bitten here — after the ship-record window emptying at midnight
# (DOC-AUDIT-WINDOW-01) and the backlog-status check that only looked at
# today's scopes (BACKLOG-STALE-ALLTIME-01). The pattern is not that the checks
# are wrong; it is that each was written to answer the question that had just
# been asked, and the NEXT question was always outside it.
#
# Roadmap side is deliberately loose: an ID mentioned ANYWHERE in roadmap.md
# counts. The roadmap is prose with tables and the item may be named in a
# horizon bullet rather than a row, and a false positive here costs more than
# a missed one (the whole point of the checks above is that a noisy check gets
# ignored). This asks only "does the roadmap know this item exists at all".
rfail2=0
# The roadmap MINUS its dated state paragraphs (see the note in the loop).
grep -vF 'State at' docs/releases/roadmap.md > /tmp/_rmplan
# ⚠️ FOURTH TIME, and the comment above predicted it while I was writing this
# one. The blockquote-bullet pattern below is only ONE of the two shapes the
# backlog actually uses. Measured 2026-09-21: it matched 19 items while TWENTY
# more sat in `### <emoji> `ID` — ...` heading form, completely unseen — and
# three of those were genuinely open with no roadmap line, two of them
# pre-existing. Both shapes are collected now. Shipped items are filtered out
# below by the registry list, so a heading left behind after a ship does not
# become a false positive.
#
# ⚠️ FIFTH TIME, 2026-10-01, AND IT WAS THIS VERY FIX THAT LEFT THE HOLE. The
# heading pattern added above required a non-space token between the hashes and
# the ID, because every heading in front of the author that day happened to
# carry an emoji (`### 🔲 `ID``). The plain shape `### `ID` — title` matched
# nothing. Measured: 124 headings seen, 146 that exist, so TWENTY items unseen,
# including `PROMPT-UNITS-ADJUST-01` filed that same morning and three filed
# that afternoon. The emoji is now OPTIONAL.
#
# 🔴 FOUND BY FALSIFICATION, NOT BY READING. The check was green; deleting a new
# item's roadmap row by hand left it green, which is the only reason anyone
# looked. **A green tick on a pattern nobody made go red is not evidence.**
{
  grep -oE '^> (🔲|🔴|🔴🔴|🔵|⏸️|⚠️) \*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`?[ —–-].*\*\(' docs/releases/backlog.md \
    | grep -oE '\*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
  grep -oE '^#{2,4} ([^ ]+ )?`[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`' docs/releases/backlog.md \
    | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
  # ⚠️ SIXTH TIME, AND IT IS THE SAME SHAPE THE SHIPPED-BUT-OPEN ARM COULD NOT
  # SEE. Both arms read the same document and each maintained its own idea of
  # what an item looks like, which is why one blind spot lands in two places at
  # once. Widening this found one real gap on the day: `SITE-FREE-COLUMN-COPY-01`
  # was filed in `backlog.md` with no roadmap line at all.
  board_tag_bullet_ids docs/releases/backlog.md
} | sort -u > /tmp/_openids
while IFS= read -r id; do
  [ -z "$id" ] && continue
  # Shipped items are not open; the registry check above owns those.
  grep -qxF "$id" /tmp/_reg && continue
  # ⚠️ A STATE BLOCK IS NOT A ROADMAP LINE. The roadmap side stays loose on
  # purpose (a horizon bullet counts, not just a table row) but the dated
  # "State at END of ..." paragraphs are a RECORD OF WHAT HAPPENED, not a plan,
  # and an item named only there is not on the roadmap in any sense a reader
  # would recognise. Measured 2026-10-01: THREE items passed this check on a
  # state-block mention alone (I predicted two), all three filed recently, which
  # is how a just-filed item disappears -- the state block naturally names it
  # while the horizon tables never gain a row.
  #
  # ⚠️ FILTERED ONCE, OUTSIDE THE LOOP, AND NOT AS A PIPELINE. The first cut was
  # `grep -vF 'State at' roadmap.md | grep -qF "$id"` inside the loop: `grep -q`
  # exits on its first match, SIGPIPEs the upstream grep, and under `pipefail`
  # the pipeline then reports FAILURE for every id that matched. It flagged 62
  # items instead of 2, which is the only reason it got looked at twice.
  grep -qF "$id" /tmp/_rmplan \
    || { say "  NO ROADMAP LINE $id (open in backlog.md)"; rfail2=1; fail=1; }
done < /tmp/_openids
[ "$rfail2" = "0" ] && say "  ok"

# ── roadmap says CLOSED while the backlog says OPEN ─────────────────────────
#
# 🔴 THE MIRROR OF THE ARM BELOW, AND IT WAS MISSING (2026-10-10). That arm asks
# "does the roadmap still show work that is done?". Nothing asked the opposite:
# **does the roadmap claim something is DONE that the backlog has re-opened?**
# `LR-NOTE-SCOPE-01` was closed on 2026-10-09 and RE-OPENED the next morning
# when its closing measurement turned out to compare the note's figure against
# its own source; the backlog heading went 🔻 and the roadmap row kept its ✅,
# and this script printed ALL CLEAN.
#
# ⚠️ IT IS THE WORSE DIRECTION OF THE TWO. A roadmap row that still shows done
# work costs a reader a second of confusion. A row that says ✅ over an OPEN
# defect removes it from "what is left" entirely — which is the exact question
# the founder asks this file, and the exact answer it would have got wrong.
# One-sided join, third recorded instance.
say "── roadmap rows marked CLOSED for a backlog item that is OPEN ──"
rcfail=0
# ⚠️ 🔴 IS EXCLUDED HERE, and it was included in the first cut — which produced a
# false positive on `RESHAPE-MOMENT-03` within a minute. In the `###` form 🔴
# means KILLED or WITHDRAWN (the all-time arm above documents this and excludes
# it for the same reason); `RESHAPE-MOMENT-03` is `### 🔴 CLOSED, NOTHING TO
# BUILD — THE PREMISE WAS FALSE`, and its roadmap ✅ is correct. A check that
# fires on correct work gets switched off, which this repo records as equivalent
# to having no check. 🟡 is excluded too: "code shipped, item still open" is a
# legitimate state where a ✅ roadmap row is defensible.
for id in $(grep -oE '^#{3,4} (🔻|🔲|🔵|⏸️|🟠|🧭|⚖️) `[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`' docs/releases/backlog.md \
              | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | sort -u); do
  # Skip anything with a registry row: shipped-but-open is the arms above's job,
  # and a part-shipped item legitimately carries both.
  grep -qxF "$id" /tmp/_reg 2>/dev/null && continue
  if grep -qE "^\|.*\(${id}\)[^|]*\| *✅" docs/releases/roadmap.md; then
    say "  ROADMAP SAYS DONE $id (backlog heading says open)"; rcfail=1; fail=1
  fi
done
[ "$rcfail" = "0" ] && say "  ok"

say "── roadmap rows still OPEN for a backlog item that is CLOSED ──"
# 🔴 SIXTH TIME, 2026-10-08, AND THE ARM ABOVE PREDICTED IT WHILE BEING WRITTEN:
# "each was written to answer the question that had just been asked, and the NEXT
# question was always outside it." The arm above asks ONE DIRECTION — an OPEN
# backlog item with no roadmap line. Nothing asked the mirror: a CLOSED backlog
# item whose roadmap row still says open.
#
# Measured when the founder asked for the three documents to be brought up to
# date: FOURTEEN rows, and `audit-docs.sh` printed ALL CLEAN over every one.
# Two were from that same session — `POSTRUN-SKELETON-PROMISE-01` and
# `READ-WORD-BUDGET-01`, whose stale BACKLOG headings had been corrected that
# morning while their roadmap rows were left behind. The other twelve were
# pre-existing, the oldest from 2026-10-05.
#
# ⚠️ AND THE COST IS NOT COSMETIC. The open set published to the founder on
# 2026-10-08 was derived from these documents and listed two already-shipped
# items as actionable. A reader scanning the roadmap for "what is left" reads
# every one of these as work.
#
# ⚠️ IT IS NARROW BY CONSTRUCTION, because a loose version here is noise. It
# looks ONLY at roadmap TABLE ROWS naming an id in their first cell, and only
# flags one whose status cell lacks ✅ while the backlog heading for that id
# carries ✅. A prose mention, a horizon bullet or a state paragraph is ignored:
# the arm above is deliberately loose about where an item is NAMED, and this one
# is deliberately strict about where its STATUS lives, because a status is only
# a status in a status cell.
#
# ⚠️ CLOSED-WITHOUT-CODE COUNTS AS CLOSED. Five of the fourteen had no registry
# row because they closed as WITHDRAWN, CLOSED-no-code, or shipped inside
# another item's commit (`POSTRUN-JOURNEY-01` parts 2 and 3). Keying off the
# registry would have missed exactly those, so this keys off the BACKLOG's own
# ✅ — the thing a reader would be looking at.
rfail3=0
# Backlog headings carrying ✅, as `id` in backticks. Emoji optional, same shape
# fix the arm above needed twice.
grep -oE '^#{2,4} [^`]*✅[^`]*`[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`' docs/releases/backlog.md \
  | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | sort -u > /tmp/_closedids
while IFS= read -r id; do
  [ -z "$id" ] && continue
  # A table row naming this id in its FIRST cell, whose SECOND cell has no ✅.
  # 🔴 THIS ARM READ THE SECOND CELL AND LOOKED FOR ✅, AND BOTH WERE WRONG (2026-11-07).
  # Its comment says "a status in a status cell", and it was written for a 3-column table. The
  # strength rows are `name | tier | size | status` and their status reads **🟢 Shipped
  # 2026-10-17**, so the arm compared `PAID` against ✅ and reported four shipped rows as open.
  # ⚠️ IT SURFACED ONLY WHEN THE BACKLOG WAS STAMPED, because the cross-check needs a ✅ on the
  # backlog side to fire at all — a latent false positive sitting behind a latent false negative.
  # Now: EVERY cell after the first, and CLOSED BY WORDS, the same rule as `heading_open_ids`.
  if awk -F' \\| ' -v id="$id" '
      /^\|/ && NF >= 3 && index($1, "(" id ")") > 0 {
        rest = ""
        for (k = 2; k <= NF; k++) rest = rest " " $k
        if (index(rest, "✅") == 0 && rest !~ /Shipped|SHIPPED|Closed|CLOSED|Withdrawn|WITHDRAWN|Dead|DEAD|Killed|KILLED|Vacated|VACATED|Superseded|SUPERSEDED/) found = 1
      }
      END { exit !found }' docs/releases/roadmap.md; then
    say "  ROADMAP ROW STILL OPEN $id (backlog says ✅)"
    rfail3=1; fail=1
  fi
done < /tmp/_closedids
[ "$rfail3" = "0" ] && say "  ok"

say "── invariants: code vs plan-invariants.md ──"
grep -oE "'INV-[A-Z0-9-]+'" lib/plan/invariants.ts | tr -d "'" | sort -u > /tmp/_a
grep -oE '^\| `INV-[A-Z0-9-]+`' docs/canonical/plan-invariants.md | grep -oE 'INV-[A-Z0-9-]+' | sort -u > /tmp/_b
d=$(comm -3 /tmp/_a /tmp/_b | wc -l | tr -d ' ')
say "  code=$(wc -l < /tmp/_a | tr -d ' ') doc=$(wc -l < /tmp/_b | tr -d ' ') orphans=$d"
[ "$d" != "0" ] && { comm -3 /tmp/_a /tmp/_b | sed 's/^/    /'; fail=1; }

# SINGLE OWNER of "is this route documented?" — used by BOTH the per-change arm
# and the standing-debt count, so the two can never drift (the producer/checker
# split this repo has paid for repeatedly).
# 🔴 A PASSING MENTION IS NOT A CONTRACT (AUDIT-CONTRACT-MENTION-01, fixed 2026-11-08).
# The second arm used to be `grep -rqF "<route path>" docs/contracts/api/`, so a route named
# ANYWHERE in another contract's prose counted as documented. Found 2026-10-04:
# `/api/ops/plan-audit` had no contract of its own and was counted because `ops-events.md`
# names it in a table row — writing the real contract moved the debt figure by ZERO.
#
# ⚠️ AND THE ITEM NAMED ONLY THE PROSE FORM. Re-measured 2026-11-08, there are TWO shapes and
# the second is worse: `grep -F` is a SUBSTRING match, so a route whose path is a PREFIX of a
# longer route's path is always "contracted". `/api/og` — the main OG image route — was
# satisfied by `og-session-complete-card.md`'s own H1. It is not a mention at all; it is a
# different route's contract, and no amount of writing prose carefully would have fixed it.
#
# This is the same class `ship-record-check.py` already guards against and this script did not:
# that hook reads the registry row's FIRST CELL precisely because *"a plain grep called
# GTM-CHARITY-02 covered because its ID appeared inside another feature's row."* A substring
# search cannot tell "this document is about X" from "this document mentions X".
#
# So the fallback is STRUCTURAL: the path must appear in an H1/H2 heading or on a `**Route:**`
# line — the shape all 56 contracts already use (`# API Contract — /api/<path>`), mirroring the
# component arm, which reads each contract's own `**Component:** \`path\`` line. The trailing
# class forbids a longer path from satisfying a shorter one.
#
# 📐 MEASURED BEFORE AND AFTER, because the increase is the finding and not a regression:
# 47 routes resolve by filename, 11 structurally, **2 by mention only** (`/api/og` and
# `/api/ops/onboarding-event`), 11 have nothing. Debt moves **11 → 13 of 71**. ⚠️ Anyone
# quoting the figure across this commit must say the DEFINITION changed, or the jump reads as
# decay — the item said so when it was filed.
contracted() {
  local rf="$1" nm rp
  nm=$(printf '%s' "$rf" | sed -E 's#^app/api/##; s#/route\.tsx?$##; s#/#-#g')
  [ -f "docs/contracts/api/${nm}.md" ] && return 0
  rp=$(printf '%s' "$rf" | sed -E 's#^app/##; s#/route\.tsx?$##')
  grep -rqE "^(#{1,2} .*|\*\*Route:\*\*.*)(/)?${rp}([^A-Za-z0-9/_-]|$)" docs/contracts/api/ 2>/dev/null && return 0
  return 1
}

say "── CONTRACTS: changed API routes vs docs/contracts ──"
# Touched = committed since SINCE **or** sitting uncommitted in the working tree.
# Committed-only would flag a contract you are editing right now, which is how a
# true check earns a reputation for crying wolf.
touched() { { git log --since="$SINCE 00:00" --name-only --pretty=format:; git status --porcelain | cut -c4-; } | sort -u; }
cfail=0
# .tsx as well as .ts — the OG routes are route.tsx, and a `.ts`-only regex
# meant this check reported ALL CLEAN while two changed routes with contracts
# were never examined (found by hand 2026-09-18, not by the script).
for f in $(touched | grep -E '^app/api/.*/route\.tsx?$'); do
  name=$(printf '%s' "$f" | sed -E 's#^app/api/##; s#/route\.tsx?$##; s#/#-#g')
  c="docs/contracts/api/${name}.md"
  # 🔴 `[ -f "$c" ] || continue` USED TO SIT HERE ALONE, AND IT MADE THIS CHECK
  # STRUCTURALLY INCAPABLE OF REPORTING A MISSING CONTRACT (2026-09-24).
  #
  # It answered "did you update an EXISTING contract?" and never "does this route
  # have one at all?", so a route with no contract was skipped in silence and could
  # never fail. Measured when the founder asked whether the docs were up to date:
  # **20 of 53 API routes had no contract anywhere**, four of them CHANGED since
  # `docs/contracts/api` was created on 2026-09-20 — the exact case this check
  # exists for, invisible to it on every push since.
  #
  # Same class as the website edge audit that collected elements CARRYING a
  # max-width when the defect was the one MISSING it: a checker that iterates what
  # exists cannot see what does not.
  #
  # ⚠️ "CONTRACTED" IS NOT "HAS A FILE NAMED AFTER IT". Several routes are
  # documented inside a GROUPED contract — `strava-oauth.md` covers connect,
  # callback and refresh. A filename-only test reports 29 of 56 missing against a
  # true 20 of 53, and a check that false-fires on a correctly documented route is
  # one that gets switched off. `contracted()` is the single predicate both arms
  # use: its own file, or its path named in any contract.
  if ! contracted "$f"; then
    say "  MISSING contract for /$(printf '%s' "$f" | sed -E 's#^app/##; s#/route\.tsx?$##') (route changed, no contract names it)"; cfail=1; fail=1; continue
  fi
  [ -f "$c" ] || continue   # documented inside a grouped contract; nothing to stale-check
  touched | grep -qx "$c" || { say "  STALE $c (route changed, contract did not)"; cfail=1; fail=1; }
done
# Standing debt, REPORTED not failed: routes that predate the convention. A count
# that must go DOWN — a debt register, not an amnesty (SWEEP-BASELINE-01's rule).
# It does not fail the run because 20 legacy contracts cannot be written in one
# sitting and a gate that blocks everything gets deleted rather than satisfied.
# What DOES fail is the arm above: touch one of them and you write its contract.
uncontracted=0; total=0
for f in $(find app/api \( -name 'route.ts' -o -name 'route.tsx' \)); do
  total=$((total+1))
  contracted "$f" || uncontracted=$((uncontracted+1))
done
say "  standing debt: ${uncontracted} of ${total} API routes have no contract (CONTRACT-COVERAGE-01)"
# 🔴 RATCHETED SINCE 2026-11-08, AND IT WAS NOT BEFORE. This number was REPORTED for weeks and
# nothing compared it to anything, so it could grow silently — a debt register with no ratchet is
# a debt register that only ever gets read. Found while PAYING it: `OPS-FN-DURATION-01` changed
# `/api/post-race-reshape`, the arm above correctly demanded its contract, it was written, and the
# count went 13 → 12. ⚠️ **A payment that can be silently undone is not a payment.** Same
# falling-only discipline as `UNCONTRACTED_BASELINE` and `UNCONTRACTED_ANY_BASELINE` above, and
# the same obligation beside the number: say whether a fall was a contract WRITTEN or a route
# DELETED, because only the first is progress.
API_UNCONTRACTED_BASELINE=11   # 12 -> 11, 2026-11-10: `strava/link-activity` CONTRACT WRITTEN (not a route removed) — AI-ROUTE-HTTP-HOP-CEILING-01 changed the route, which obliges one
if [ "$uncontracted" -gt "$API_UNCONTRACTED_BASELINE" ]; then
  say "  GREW: ${uncontracted} uncontracted API routes, baseline ${API_UNCONTRACTED_BASELINE} — write the contract for the new route"
  cfail=1; fail=1
elif [ "$uncontracted" -lt "$API_UNCONTRACTED_BASELINE" ]; then
  say "  debt PAID: ${uncontracted} (baseline ${API_UNCONTRACTED_BASELINE}) — lower API_UNCONTRACTED_BASELINE, saying whether a contract was WRITTEN or a route DELETED"
  cfail=1; fail=1
fi
[ "$cfail" = "0" ] && say "  ok"

say "── CONTRACTS: changed components vs docs/contracts/components ──"
# Mirrors the API check above. The mapping comes from each contract's own
# `**Component:** \`path\`` line, NOT from a list in this script — a checker
# holding the producer's list is blind to that list.
kfail=0
for c in docs/contracts/components/*.md; do
  [ -f "$c" ] || continue
  comp=$(sed -n 's/^\*\*Component:\*\* *`\([^`]*\)`.*/\1/p' "$c" | head -1)
  [ -n "$comp" ] && [ "$comp" != "none" ] || continue
  touched | grep -qx "$comp" || continue          # component unchanged today
  touched | grep -qx "$c" || { say "  STALE $c (component changed, contract did not)"; kfail=1; fail=1; }
done
[ "$kfail" = 0 ] && say "  ok"

say "── CONTRACTS: a SHARED component with no contract at all ──"
# 🔴 THE ARM ABOVE ONLY ASKS ONE DIRECTION, AND THAT IS HOW 20 COMPONENTS SHIPPED
# UNCONTRACTED UNDER A GREEN AUDIT (2026-09-29). It iterates the CONTRACTS and asks
# "did a contracted component change without its doc?" — so a component with no
# contract is not in the population at all, and the audit reports ok by not looking.
# Same class as every other short population this repo has recorded: the predicate
# was right and the set was wrong.
#
# This asks the inverse: a component under `components/shared/` that EXPORTS a prop
# interface and is imported by more than one file should have a contract. Existing
# debt is declared below so it is visible and cannot grow.
UNCONTRACTED_BASELINE=42   # 49 -> 42, 2026-11-10 (CONTRACT-COVERAGE-03, W5): SEVEN CONTRACTS WRITTEN,
                           # not seven components deleted — `SegmentedControl` (6 importers), `DurationPicker` (6),
                           # `ActionRow` (6), `ZoneRings` (5), `CoachNoteBlock` (5), `Chip` (5), `Chevron` (5).
                           # ⚠️ The pair below only distinguishes the DROP-OUT move, so saying which happened is the
                           # whole discipline: `git log --diff-filter=A docs/contracts/components/` is the proof.
                           # 🔴 The item's "highest reach first" list was stale for the THIRD time — six of its eight
                           # were contracted in W4, and the live top was `SegmentedControl`/`ActionRow`, absent from it.
                           # ⚠️ 50 -> 49, 2026-11-08 (code review, SAME DAY): a RE-COUNT, not a
                           # payment. Membership now parses the `**Components:**` LIST form as
                           # well as the singular header, so `components/marketing/PhoneFrame.tsx`
                           # — 2 importers, governed only by `marketing-device.md`'s list — stops
                           # counting as uncontracted. **Exactly one component moved and it was
                           # already contracted**; no debt was paid by this line.
                           # 🔴 56 -> 50, 2026-11-08 (CONTRACT-COVERAGE-03, W4): SIX contracts
                           # WRITTEN — `TextField` (9 importers), `Wordmark` (8),
                           # `AppStoreBadge` (8), `ArticlePage` (10), `IconButton` (7),
                           # `AIMark` (7) — highest reach first, because a contract is a code
                           # review and the review is worth most where the blast radius is.
                           # ⚠️ A SEVENTH was written and DOES NOT move this number:
                           # `LedgerCard` has ONE importer, so it is outside this population.
                           # Conflating the two is the register-over-counting failure this
                           # repo records, and it is exactly what `CONTRACT-LEDGERCARD-01`
                           # was filed about. 📐 The item's "highest reach first" list was
                           # stale: it ranked `ArticlePage` SIXTH at 6 importers and it is
                           # FIRST at 10, and it omitted `SegmentedControl`, `ActionRow` and
                           # `ZoneRings` from the top nine entirely.
                           # 58 -> 57, 2026-10-14: `AdjustmentDiff` gained a prop
                           # (`stagger`, CONFIRM-STAGGER-01) and had no contract to
                           # update, so CLAUDE.md's same-commit rule had nothing to
                           # bite on. Written; the gate diffs its props against the
                           # component and goes red if either side drifts.
#   # ⚠️ 59 → 58, 2026-10-10 (second payment, same day): `TodayScreen`
# gained a contract because `BASEBUILD-HANDOVER-01` added four props to it and it had none,
# while being one of the register-counted components (4 importers). ⚠️ `ModifyPlanSheet` also
# gained a real contract the same day and it does NOT move this number: it has ONE importer,
# and this register counts only components with >= 2. Stating that so the two payments are not
# conflated — the register-over-counting failure this repo records.
# Prior note: ⚠️ 60 → 59, 2026-10-10: `RefusalView` gained a real contract in
# `docs/contracts/components/refusal-view.md` because `PREP-ACK-NO-WRITER-01` changed its PROP
# INTERFACE, and `COMPONENT-CONTRACT-GATE-01` accepted it (fenced `interface` block + a
# `**Component:**` line, both of which it refused on my first attempt). ⚠️ THIS IS A REAL
# PAYMENT, UNLIKE THE LAST ONE: the earlier 59 was reverted because `session-detail-notes.md`
# documents a NOTE FAMILY rather than a component's props and the gate rightly refused it, so the
# debt was never paid. This one is a component contract the gate verifies against the component.
# Prior note, kept: ⚠️ 59 → 60, REVERTED same day: `session-detail-notes.md` documents a NOTE FAMILY, not a component's props, so COMPONENT-CONTRACT-GATE-01 refused it in docs/contracts/components/ and it moved a level up. The debt was never paid — claiming it was is the register-over-counting failure this repo records.
#                          # 🔴 61 → 60 (LEDGER-COACH-SITE-REMOVE-01, 2026-10-05) AND IT IS A THIRD KIND OF MOVE, NEITHER PAID NOR DELETED.
                           # `LedgerCard` is STILL UNCONTRACTED. It had two importers (DashboardClient + MeScreen); removing the Coach render
                           # site left ONE, so it fell below this arm's `users >= 2` threshold and dropped out of the POPULATION. Lowering the
                           # number is right — the register must describe reality and may only fall — but recording it as a payment would be a lie.
                           # ⚠️ AND THE PROXY GAVE THE WRONG ANSWER HERE. `>= 2 importers` stands in for "shared", and `LedgerCard` just became
                           # the SINGLE render path of a FREE feature (LEDGER-REACH-01), so it deserves a contract MORE than it did yesterday,
                           # not less. Filed as `CONTRACT-LEDGERCARD-01`. ⚠️ If anyone imports it a second time this count goes back to 61 and
                           # this arm will say GREW and blame them — the entry is here so that reads as expected, not as a regression.
                           # 🔴 49 → 65 → 61 (CONTRACT-COVERAGE-02, 2026-10-02). TWO MOVES IN ONE COMMIT AND THEY ARE OPPOSITE, so both are stated: the population was WIDENED (49 → 65, a register growing because it RE-COUNTED, not because debt was added) and then four contracts were WRITTEN (65 → 61, debt genuinely paid). Quoting only the net −12... there is no net: the two numbers measure different sets and averaging them would describe neither. Both derived by RUNNING the arm, never typed — this is the same register whose first value I set to 14 from memory and watched fire on its first run.
                           # ⚠️ AND A STRAY FILE WAS INFLATING IT BY 2. A tracked 1,960-line file literally named `components/...` (an April copy of DashboardClient, `a968d267`) matched the importer greps, pushing `StravaPanel` and `PlanChart` over the ≥2 threshold. It is deleted. Interactive `ugrep` skipped it and system `grep` did not, which is why the shell and a python re-count disagreed by exactly 2 — reconcile two registers before trusting either.
                           # 50 → 49 (ME-ADJUSTMENTS-EXTRACT-01, 2026-10-02): debt genuinely PAID — `PlanAdjustmentsScreen` was extracted AND contracted in the same commit, so a shared component gained a contract rather than leaving the tree. 🥇 The arm demanded this move itself, on the same day the ship-record ratchet was restored from a baseline that had been lowered on an UNMEASURED premise — a register asking to be lowered because it re-counted is the only direction it may move on its own.
                           # 51 → 50 (QUIT-TAB-DEAD-01, 2026-10-01): the debt was not PAID, the component was DELETED. An uncontracted shared component leaving the tree lowers this exactly as writing its contract would, and the audit cannot tell the two apart — worth knowing before quoting a falling number as documentation progress.
                           # 🔴 MEASURED, NOT GUESSED. I set this to 14 first — today's
                           # extracted screens — on the assumption the rest of the tree was
                           # contracted. It is not: 52 shared components have no contract,
                           # against 20 that do. The arm fired on its FIRST RUN and the
                           # number was mine, not the code's, which is the same "wrote the
                           # value before measuring the population" mistake recorded all
                           # week. The 14 extractions moved VERBATIM, so their interfaces
                           # pre-date today; the other 38 are older debt this arm had no
                           # way of showing until now. Falling-only: contract one and the
                           # baseline must come down in the same commit.
# 🔴 THE WHOLE COMPONENT TREE, AND BOTH IMPORT FORMS (CONTRACT-COVERAGE-02,
# re-measured 2026-10-02). Two holes, compounding, and the register read healthy
# through both:
#
#   1. SCOPE. This globbed `components/shared/*.tsx` and `components/dashboard/*.tsx`
#      only -- **2 of 7 component directories, 80 of 219 files**. `components/`
#      root (111 files), `ui`, `marketing`, `training` and `strava` were never in
#      the population, so **13 further uncontracted components could not be
#      counted** -- including `SiteHeader` (12 importers) and `SiteFooter` (11),
#      which render the public WEBSITE.
#   2. IMPORT FORM. `from '@/<path>'` is one of two ways to import a sibling. A
#      RELATIVE import (`from './DayGridSelector'`) did not count, so three
#      components fell under the `>= 2` threshold. `HrPendingStatusRow` is used by
#      `PendingHrCard` AND `SessionCard`, both relatively, so the gate saw **0
#      importers** and the component was absent entirely.
#
# ⚠️ AND TEN WRITTEN CONTRACTS SAT OUTSIDE THE POPULATION, including
# `components/ui/Button.tsx` with **39 importers** -- the most-used component in
# the app. Its contract existed and this arm could not see it, so deleting the
# file would not have gone red. That is what the second loop below now asserts.
#
# The number RISES on this fix (49 -> 65) and that is a register growing because
# it RE-COUNTED, not because debt was added. Same declaration discipline as
# lowering it: both figures, in the comment, derived by running the arm.
# The ANY-importer figure. 📐 Measured by RUNNING THE ARM, 2026-11-08: **72** uncontracted
# components in all — 50 at >= 2 importers, 20 at exactly one, and **2 with ZERO importers**.
#
# 🔴 I SET THIS TO 70 FIRST, BY ARITHMETIC (50 + 20), AND THE ARM FIRED ON ITS FIRST RUN.
# The two zero-importer components were outside the script I used to count the 20, which
# filtered `users -eq 1`. **This is the same "wrote the value before measuring the population"
# mistake `UNCONTRACTED_BASELINE`'s own comment records about its first value of 14** — in the
# commit that added a second register to make the first one honest. The arm catching it is the
# argument for the arm.
#
# ⚠️ 72 -> 71, 2026-11-08 (code review, same day): a RE-COUNT, not a payment — `PhoneFrame` is
# governed by the `**Components:**` list form, which membership could not read. Code review
# predicted 71 before the change was made.
#
# Falling-only, same discipline as the gated figure above: a component leaving the tree lowers
# it exactly as a contract does, so say which happened.
#
# ⚠️ 71 -> 70, 2026-11-08: **A DELETION, NOT A PAYMENT.** `components/shared/Select.tsx` was
# removed (`SELECT-DEAD-01`) — zero importers, superseded by `WheelPicker` for the year-of-birth
# step its own docblock named as its first and only use. No contract was written. The other
# register held at 49 through the change, which is exactly the signature this pair exists to
# show: a component at zero importers was never inside the `>= 2` population, so a real
# payment there is still owed.
UNCONTRACTED_ANY_BASELINE=63  # 70 -> 63, 2026-11-10 (CONTRACT-COVERAGE-03, W5): the SAME seven contracts.
                              # 🔑 BOTH FIGURES MOVED BY SEVEN, which is what a payment at >= 2 importers looks
                              # like; a component DROPPING below the line would have moved the first and left this
                              # one FLAT. That is the one move the pair exists to separate.

# ── 🔴 TWO NUMBERS, BECAUSE ONE CANNOT TELL A PAYMENT FROM A DROP-OUT ────────
#
# `CONTRACT-LEDGERCARD-01`, answered 2026-11-08. The register went 61 → 60 when
# `LEDGER-COACH-SITE-REMOVE-01` took `LedgerCard` from two importers to one: it left the
# `>= 2` POPULATION while still being uncontracted. Lowering the number was right — the
# register must describe reality — but it reads exactly like a payment, and this arm's own
# comment already recorded that it *"cannot tell a contract being written from a component
# being deleted"*. That is now THREE indistinguishable moves behind one figure.
#
# ⚠️ THE ITEM ASKED WHETHER TO WIDEN THE THRESHOLD to *"≥2 importers OR named in a
# tier-tagged registry row"*. 📐 Measured before deciding: **20 components have exactly one
# importer and no contract, 16 of them named somewhere in the feature registry** — so
# widening would take the gated figure 50 → 66, a 32% jump, and the "named in a registry row"
# test is itself a loose grep that matches a prose mention (the mention-vs-filing class this
# repo has paid for four times). **Declined. The threshold was never the defect.**
#
# 🔑 The defect is that one number cannot express the move. So: `missing` stays the gated
# `>= 2` figure, and `missing_any` counts uncontracted components at ANY importer count.
# A component dropping out of the `>= 2` population moves `missing` DOWN and leaves
# `missing_any` UNCHANGED — the signature a payment does not have, visible without anyone
# remembering last week's figure.
#
# ⚠️ AND THAT IS ONE MOVE OF THREE, NOT ALL THREE — the commit message that shipped this pair
# overclaimed, and code review caught it the same day. Precisely what the pair separates:
#
#   | move                                   | `missing` | `missing_any` |
#   |----------------------------------------|-----------|---------------|
#   | a contract WRITTEN for a >= 2 component|   down    |     down      |
#   | a >= 2 component DELETED               |   down    |     down      |  <- still identical
#   | a component DROPPING below >= 2        |   down    |   unchanged   |  <- now visible
#   | a 0/1-importer component DELETED       | unchanged |     down      |
#   | a 0/1-importer component CONTRACTED    | unchanged |     down      |  <- still identical
#
# **So a DELETION and a PAYMENT remain indistinguishable at the same importer tier.** That was
# already true before this change and is unchanged by it; what is new is that the THIRD move —
# the one `CONTRACT-LEDGERCARD-01` was filed about — now has its own signature. The remaining
# pair can only be told apart by saying which happened, which is why both baseline comments
# carry that instruction and why this register is falling-only.
# ── 🔴 ONE DERIVATION OF "WHAT IS CONTRACTED", BOUNDED (code review, 2026-11-08) ─────
#
# Membership used to grep for `^**Component:** \`path\`` only — the singular header. But
# `marketing-device.md` governs three components through a `**Components:**` BULLET LIST, so
# `components/marketing/PhoneFrame.tsx` counted as UNCONTRACTED in both registers while having a
# real contract, and a future list-form contract would have moved neither figure. ⚠️ **The orphan
# arm below already parses both forms**, in a comment saying a one-form parser *"quietly declines
# to check the other"* — two arms on the same directory disagreeing about what a contract looks
# like is the duplicate-derivation defect this repo keeps paying for.
#
# 🔴 AND THE FIRST FIX WAS A LOOSE GREP THAT FOUND A FALSE POSITIVE IMMEDIATELY. Widening to
# `^- .*\`path\`` matched a bullet ANYWHERE in ANY contract — including `ledger-card.md`'s
# Consumers list, `- \`components/dashboard/MeScreen.tsx\` — so `MeScreen` read as contracted.
# **A path NAMED in a contract is not a path GOVERNED by one**: the mention-vs-filing class,
# re-created inside the fix for an instance of it. **Bound the region, never grep the file.**
#
# So: one awk pass, the SAME bounding as the orphan arm (a `**Components?:**` header opens the
# block, a blank line closes it), into a set every component is then tested against by exact
# match.
for c in docs/contracts/components/*.md; do
  [ -e "$c" ] || continue
  awk '
    /^\*\*Components?:\*\*/ { inlist=1 }
    inlist && /`/ { print }
    inlist && /^$/ { inlist=0 }
  ' "$c"
done | grep -oE '`[^`]+`' | tr -d '`' | grep -E '^components/.*\.tsx$' | sort -u > /tmp/_contracted_paths
# A zero here would make the membership test below accept everything as uncontracted.
if [ "$(wc -l < /tmp/_contracted_paths | tr -d ' ')" -lt 20 ]; then
  say "  CONTRACT SET VACUOUS: only $(wc -l < /tmp/_contracted_paths | tr -d ' ') governed paths parsed, expected 20+"
  fail=1
fi

missing=0
missing_any=0
in_population=0
for f in $(git ls-files 'components/*.tsx' 'components/**/*.tsx'); do
  [ -f "$f" ] || continue
  case "$f" in *.test.*|*.stories.*) continue;; esac
  grep -q "^export default function\|^export function" "$f" || continue
  in_population=$((in_population+1))
  base=$(basename "$f" .tsx)
  # more than one importer, counting BOTH the alias form and a relative path
  users=$(grep -rlE "from '@/${f%.tsx}'|from '\.{1,2}/([A-Za-z0-9_/-]*/)?${base}'" app components 2>/dev/null | grep -v '\.test\.' | grep -v "^$f$" | wc -l | tr -d ' ')
  if ! grep -qxF "$f" /tmp/_contracted_paths; then
    missing_any=$((missing_any+1))
    [ "$users" -ge 2 ] && missing=$((missing+1))
  fi
done

# 🔴 A WRITTEN CONTRACT MUST NOT SILENTLY LOSE ITS COMPONENT. The arm above counts
# what is MISSING a contract; nothing asserted the reverse, so a contract whose
# component was renamed or deleted would sit in `docs/contracts/components/`
# describing nothing, and `Button.tsx`'s was unreachable by any arm at all.
#
# ⚠️ THREE HEADER FORMS, AND MY FIRST CUT KNEW ONE -- the same mistake this file
# records four times over. `**Component:** \`path\`` is the common form, but
# `me-door-navigation.md` declares `**Component:** \`none\`` deliberately (it
# documents a behaviour ACROSS components, not one component), and
# `marketing-device.md` uses `**Components:**` with a bulleted LIST of three.
# The first cut flagged the declared `none` as an orphan and skipped the list
# ENTIRELY -- so that contract's three components could all have been deleted in
# silence, which is the failure this arm exists to catch.
orphan_contracts=0
checked_paths=0
for c in docs/contracts/components/*.md; do
  [ -e "$c" ] || continue
  # Every backticked path on a `**Component:**`/`**Components:**` line or, for the
  # list form, on the bullets that follow it. A declared `none` is not a path.
  paths=$(awk '
    /^\*\*Components?:\*\*/ { inlist=1 }
    inlist && /`/ { print }
    inlist && /^$/ { inlist=0 }
  ' "$c" | grep -oE '`[^`]+`' | tr -d '`' | grep -E '^components/.*\.tsx$' || true)
  for comp in $paths; do
    checked_paths=$((checked_paths+1))
    [ -f "$comp" ] && continue
    say "  ORPHAN CONTRACT $(basename "$c") describes $comp, which does not exist"
    orphan_contracts=$((orphan_contracts+1)); fail=1
  done
done
# A zero here would make the loop above vacuous -- the shape of failure this
# whole section exists to catch.
if [ "$checked_paths" -lt 20 ]; then
  say "  ORPHAN ARM VACUOUS: only $checked_paths contract paths parsed, expected 20+"
  fail=1
elif [ "$orphan_contracts" = "0" ]; then
  say "  every written contract still names a live file ($checked_paths paths)"
fi
# 2026-10-01 — 52 → 51. `SHEET-CONTRACT-01` contracted `Sheet`, the most-used
# primitive in the app. The ratchet asked for the lower number rather than
# letting a paid debt sit as slack, which is the only direction this register is
# allowed to move on its own.
# 🔴 A VACUITY FLOOR ON BOTH REGISTERS (code review, 2026-11-08). If the population filter ever
# stops matching — a codebase-wide move to `export const X = () =>`, a renamed directory — both
# figures collapse toward 0 and **both arms would instruct LOWERING the baselines**, i.e. the
# registers would congratulate themselves into nothing. The orphan arm below already carries
# exactly this guard (`checked_paths -lt 20`) and these two did not.
#
# ⚠️ AND THE FIRST CUT OF THIS FLOOR GUARDED THE WRONG NUMBER. It counted `git ls-files` of
# component files, which the EXPORT FILTER cannot affect — so breaking
# `^export default function` / `^export function`, the exact scenario code review named, left the
# floor silent. **Falsified by breaking that filter and watching the floor stay quiet.** It now
# counts `in_population`: the components that actually passed the filter.
# 📐 Measured by running it: 140 of 219 component files reach the population today. 100 is a floor no healthy
# tree crosses and a broken filter always does.
if [ "$in_population" -lt 100 ]; then
  say "  CONTRACT REGISTERS VACUOUS: only $in_population components passed the export filter, expected 100+"
  say "    Both figures below are meaningless. Check the population filter, not the baselines."
  fail=1
fi
if [ "$missing" -gt "$UNCONTRACTED_BASELINE" ]; then
  say "  GREW: $missing shared components with no contract, baseline $UNCONTRACTED_BASELINE"
  fail=1
elif [ "$missing" -lt "$UNCONTRACTED_BASELINE" ]; then
  say "  debt PAID: $missing (baseline $UNCONTRACTED_BASELINE) — lower UNCONTRACTED_BASELINE"
  fail=1
else
  say "  $missing uncontracted, unchanged (declared debt)"
fi

# ── the SECOND number, and the pair is the signal (CONTRACT-LEDGERCARD-01) ───
# ⚠️ GATED TOO, falling-only, because a figure nothing checks drifts — this file's own
# recorded lesson. The pair is what reads: `missing` down and `missing_any` FLAT is a
# component leaving the `>= 2` population, not a contract being written.
if [ "$missing_any" -gt "$UNCONTRACTED_ANY_BASELINE" ]; then
  say "  GREW (any importer count): $missing_any uncontracted, baseline $UNCONTRACTED_ANY_BASELINE"
  fail=1
elif [ "$missing_any" -lt "$UNCONTRACTED_ANY_BASELINE" ]; then
  say "  debt PAID (any importer count): $missing_any (baseline $UNCONTRACTED_ANY_BASELINE) — lower UNCONTRACTED_ANY_BASELINE"
  fail=1
else
  say "  $missing_any uncontracted at ANY importer count, unchanged ($(( missing_any - missing )) of them below the >= 2 line)"
fi

say "── coaching rounds: ruling written back ──"
# A round whose review.md still says REVIEW PENDING is a sitting whose outcome
# was never recorded -- which is exactly how the board came to re-litigate two
# items it had already closed (see docs/canonical/coaching-rulings.md).
pending=0
for f in coaching-review/*/review.md; do
  [ -e "$f" ] || continue
  # Anchored to the STUB MARKER at line start, not any mention of the phrase:
  # the first cut matched a round whose write-up explains the phrase, which is
  # a guard reading prose instead of a marker.
  if grep -qE '^\*\*REVIEW PENDING\*\*' "$f"; then say "  PENDING $f -- sitting outcome never written back"; pending=1; fail=1; fi
done
[ "$pending" = "0" ] && say "  ok"

say ""
say "── state blocks name the last SHIP ──"
last=$(git log --pretty=format:'%h %s' | grep -E '^[a-f0-9]+ (feat|fix|perf)\(' | head -1 | cut -d' ' -f1)
# ⚠️ COMPARE ON A FIXED 7-CHAR PREFIX, NOT ON `%h`. `core.abbrev` is unset, so
# `%h` scales its length with the repo's object count and is ENVIRONMENT-
# DEPENDENT: a state block written in a cloud container stamped `309e1c3` (7)
# while this machine's `%h` for the same commit is `309e1c31` (8), so
# `grep -v 309e1c31` counted a block that names the ship exactly as STALE.
# Measured 2026-10-02: backlog.md AND roadmap.md both flagged, both correct.
# A false STALE is the expensive direction here -- the recorded response to a
# state-block warning is to rewrite the paragraph, so this check pointed at the
# one artifact that did not need touching. 7 is the floor git will ever abbreviate
# to, so the prefix matches a 7-, 8- or 40-char stamp alike; it is strictly more
# permissive than the old compare and loses nothing, since the alternative read
# of a shared 7-char prefix is a different commit that is also an ancestor.
# Falsified by stamping a block with a wrong SHA of each length (7 and 8): both
# report STALE.
last7=${last:0:7}
mem="$HOME/.claude/projects/$(pwd | tr '/' '-')/memory/MEMORY.md"
sfail=0
# ⚠️ EVERY state paragraph, not "does the file mention the SHA somewhere".
# 2026-09-19: both files carried TWO "State at end of ..." paragraphs. One was
# current and one was hours old, asserting a superseded SHA and stale counts --
# and this check passed, because `grep -q "$last" "$f"` is satisfied by ANY
# occurrence. A file with one fresh block and one rotten one read as clean.
# The lowercase/uppercase split ("State at end" vs "State at END") is why the
# duplicate went unnoticed by eye too, so the pattern matches both.
for f in docs/releases/backlog.md docs/releases/roadmap.md; do
  blocks=$(grep -c '^\*\*State at \(end\|END\) of' "$f" || true)
  if [ "$blocks" = "0" ]; then
    say "  STALE $f has no state paragraph at all"; sfail=1; fail=1; continue
  fi
  stale=$(grep '^\*\*State at \(end\|END\) of' "$f" | grep -vc "$last7" || true)
  if [ "$stale" != "0" ]; then
    say "  STALE $f: $stale of $blocks state paragraph(s) do not name last ship $last"; sfail=1; fail=1
  fi
done
[ -f "$mem" ] && { grep -q "$last7" "$mem" || { say "  STALE MEMORY.md does not name last ship $last"; sfail=1; fail=1; }; }
# 🔴 AND ITS SIZE, BECAUSE THE TRUNCATION IS SILENT AND COSTS INDEX LINES.
# 2026-10-02: MEMORY.md reached 26,296 bytes against a 24,400-byte load limit and
# **2 index entries stopped being loaded at all** -- the warning arrives inside the
# file's own injected copy, i.e. only to a session that already has the truncated
# version, and it names the first line cut rather than the budget. Nothing in this
# repo could see it. The tail of that file is the "How I should work" list, so what
# silently drops first is the feedback, which is the half with no other copy.
# Budget deliberately below the limit: a state block is ~500 bytes and a day adds
# one, so a check that only fires AT the limit fires after the loss.
#
# 🔴 AND IT HAPPENED AGAIN ON 2026-10-09, BECAUSE THERE ARE **TWO** LIMITS AND THIS
# GATE ONLY KNEW ONE. The file was 23,100B -- comfortably inside the byte budget and
# reported ALL CLEAN -- and **201 LINES against a 200-line limit**, so the loader cut
# line 201 and dropped `Rebrand Gotchas` from the index. The warning again arrived
# only inside the truncated copy.
#
# ⚠️ The byte budget was written the day the first truncation was found, against the
# only limit that incident exposed. **A gate built from one incident knows one
# failure mode**, and a day that adds index LINES without adding many bytes walks
# straight past it -- which is exactly what a run of short feedback hooks does.
MEM_BUDGET=23800
MEM_LINE_BUDGET=195
if [ -f "$mem" ]; then
  mbytes=$(wc -c < "$mem" | tr -d ' ')
  mlines=$(wc -l < "$mem" | tr -d ' ')
  if [ "$mbytes" -gt "$MEM_BUDGET" ]; then
    say "  OVER BUDGET MEMORY.md is ${mbytes}B against ${MEM_BUDGET}B (hard load limit 24400B)"
    say "            index entries are truncated from the END, which is the feedback list."
    say "            Move detail into a topic file and leave a one-line hook."
    sfail=1; fail=1
  fi
  # Line budget deliberately below 200, for the same reason the byte budget sits below
  # 24400: a day adds index lines, so a check that fires AT the limit fires after the loss.
  if [ "$mlines" -gt "$MEM_LINE_BUDGET" ]; then
    say "  OVER LINE BUDGET MEMORY.md is ${mlines} lines against ${MEM_LINE_BUDGET} (hard load limit 200)"
    say "            Lines are cut from the END just as bytes are, so the feedback list goes first."
    say "            MERGE two related index entries rather than deleting one."
    sfail=1; fail=1
  fi
fi
[ "$sfail" = "0" ] && say "  ok"

say ""
say "── reverts: the records must not still claim it is live ──"
# 🔴 THE GAP THIS CLOSES. `SHEET-ORIGIN-01` shipped and was reverted the same
# day, and this audit printed ALL CLEAN while the feature registry described it
# as shipped, `ui-patterns.md` documented it as the pattern, and nothing was
# re-opened. A reader would have believed pill-width sheets were in the app.
#
# `/ship` § Reverting a ship already says: move the entry back to the backlog
# with a status note, do NOT silently delete from the registry. Nothing checked
# that it had been done.
#
# The rule: a `revert(SCOPE)` commit means that id must be marked reverted in the
# registry AND re-opened in the backlog.
vfail=0
python3 - <<'PYEOF' || vfail=1
import re, subprocess, sys, pathlib
log = subprocess.run(['git','log','--pretty=format:%s'],capture_output=True,text=True).stdout.split('\n')
# ⚠️ ONLY WHERE THE REVERT IS THE ITEM'S LATEST SHIP-SHAPED COMMIT. The log is newest first, so the first
# feat/fix/revert seen for a scope decides. Before this, an item reverted once and re-shipped later
# (SHEET-ORIGIN-01: reverted 2026-09-26, re-shipped 2026-10-24) was flagged forever as reverted-but-live.
ids, seen = [], set()
for line in log:
    m = re.match(r'(revert|feat|fix)\(([^)]+)\)', line)
    if not m or m.group(2) in seen: continue
    seen.add(m.group(2))
    if m.group(1) == 'revert': ids.append(m.group(2))
reg = pathlib.Path('docs/canonical/feature-registry.md').read_text(encoding='utf-8')
bl  = pathlib.Path('docs/releases/backlog.md').read_text(encoding='utf-8')
bad = []
for i in ids:
    # ⚠️ ANCHORED AT THE START OF THE FIRST CELL, and id-shaped only. The first
    # cut used `i in cell`, which matched a scope of `engine` against the row
    # "Plan generation — personalised (rule engine + AI enrichment)". Substring
    # bias, the class this repo has recorded more than any other.
    if not re.match(r'^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d+$', i):
        continue
    row = next((l for l in reg.split('\n')
                if l.strip().startswith('|') and l.split('|')[1].strip().startswith(i)), None)
    if row is None:
        continue   # never registered; nothing to correct
    # 🔴 THE FIRST CELL, NOT THE WHOLE ROW. The first cut tested the row and
    # was HOLLOW: a reverted item's DESCRIPTION always explains the revert, so
    # "REVERT" was present however the status cell read. Falsified by blanking
    # the status and watching it stay green. Same lesson `ship-record-check.py`
    # already carries: assert STRUCTURE, not presence.
    if 'REVERT' not in row.split('|')[1].upper():
        bad.append(f"  {i}: registry row's FIRST CELL does not say REVERTED — a reader thinks it is live")
    if not re.search(r'^###\s.*' + re.escape(i), bl, re.M):
        bad.append(f"  {i}: reverted but not re-opened in the backlog (/ship § Reverting a ship)")
if bad:
    print("\n".join(bad)); sys.exit(1)
print("  ok")
PYEOF
[ "$vfail" = 1 ] && fail=1

say "── board rulings: a SHIP ruling has its PATTERN artifact ──"
# ⚠️ THE THIRD ARTIFACT WAS THE ONE NOTHING CHECKED.
#
# ADR-023: every SHIP ruling lands THREE artifacts in one commit -- pattern,
# token/constant, and a mechanical check made to go red. This audit already
# catches a ruling with no register row. It has never caught a SHIP ruling with
# no PATTERN, and on 2026-09-26 `LINK-HIERARCHY-01` shipped four clauses with
# nothing in `ui-patterns.md` while the audit printed ALL CLEAN.
#
# Same shape as everything else found today: the check's list was short. It
# looked at whether the RULING was recorded and never at whether the rule the
# ruling produced was written where the next person would read it.
pfail=0
python3 - <<'PYEOF' || pfail=1
import re, sys, pathlib
rule = pathlib.Path('docs/canonical/design-rulings.md').read_text(encoding='utf-8')
pat  = pathlib.Path('docs/canonical/ui-patterns.md').read_text(encoding='utf-8')
# Pre-existing debt, declared so it is visible and cannot GROW. A reason each.
BASELINE = {
    'CTA-FLAT-01':              'ruled, not built -- founder wanted mock-ups first; no pattern to write yet',
    'DESIGN-EMPTYSTATE-ART-01': 'website section, not an app component pattern',
    'SITE-GROUND-ABOUT-01':     'website ground, governed by brand.md rather than ui-patterns',
}
missing = {}
for m in re.finditer(r'^#{2,3}\s+(.*)$', rule, re.M):
    h = m.group(1)
    H = h.upper()
    # ⚠️ \bSHIP\b AS A WORD. The first cut used `'SHIP' in H`, which matched
    # "nothing shipped" in an INSUFFICIENT-EVIDENCE heading and demanded a
    # pattern for a ruling that deliberately built nothing. Found by the push
    # hook within an hour of the check shipping -- the SECOND gate I wrote today
    # to have a false positive on the day. A gate that cries wolf gets switched
    # off, which this repo records as equivalent to having no gate.
    if not re.search(r'\bSHIP\b', H):
        continue
    if any(v in H for v in ("DON'T SHIP", 'INSUFFICIENT EVIDENCE', 'KILLED', 'REVERTED', 'NOT BUILT')):
        continue
    for i in set(re.findall(r'\b([A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+-\d+)\b', h)):
        if i not in pat and i not in BASELINE:
            missing[i] = h[:70]
stale = [i for i in BASELINE if i in pat]
if missing:
    for i, h in sorted(missing.items()):
        print(f"  MISSING PATTERN: {i} -- SHIP ruling with nothing in ui-patterns.md ({h})")
if stale:
    for i in stale:
        print(f"  STALE BASELINE: {i} now has a pattern -- delete its BASELINE entry")
if missing or stale:
    sys.exit(1)
print("  ok")
PYEOF
[ "$pfail" = 1 ] && fail=1

say "── board rulings: a DOCTRINE section that names a board has a register row ──"
# 🔴 THE ARM BELOW READS BACKLOG HEADINGS, AND THAT IS A POPULATION, NOT THE RULE.
#
# On 2026-10-07 `PROGRESSION-TRANSITION-01` shipped a Coaching Board CORRECT WITH
# AMENDMENT -- principle §, config constant, invariant, liveness mutation, the lot --
# and had NO row in `coaching-rulings.md`, while this script printed ALL CLEAN. It was
# never in the backlog: founder report -> board -> ship. **The checker's population
# excluded the cases at risk**, which is the single most repeated failure in this repo.
#
# The rule that does not depend on the backlog: **a doctrine section that ATTRIBUTES
# ITSELF to a board is a ruling by its own words.** If `CoachingPrinciples.md` or
# `ui-patterns.md` says "Coaching Board" or "Design Board" beside an item id, that id
# belongs in a register the settled-ground scan actually reads.
#
# ⚠️ DEBT, DECLARED, NOT EXEMPTIONS. 50 sections were already in neither register when
# this shipped -- `coaching-rulings.md` is far younger than the constitution, so most of
# them predate it. The baseline stops the number GROWING; it does not shrink it, and
# nothing here schedules that.
dfail=0
python3 - <<'PYEOF' || dfail=1
import re, sys, json, pathlib
docs = ['docs/canonical/CoachingPrinciples.md', 'docs/canonical/ui-patterns.md']
reg = (pathlib.Path('docs/canonical/coaching-rulings.md').read_text(encoding='utf-8')
       + pathlib.Path('docs/canonical/design-rulings.md').read_text(encoding='utf-8'))
base = json.loads(pathlib.Path('lib/plan/__fixtures__/boardRulingRegisterDebt.json').read_text(encoding='utf-8'))
known = {tuple(e['ids']) for e in base['unregistered']}
known_noid = set(base['no_id'])
ID = re.compile(r'\b([A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+-\d{2})\b')
BOARD = re.compile(r'(Coaching Board|Design Board)', re.I)
found, new = 0, []
for d in docs:
    text = pathlib.Path(d).read_text(encoding='utf-8')
    # ⚠️ A `> ` PREFIX IS ALLOWED, AND THE FIRST CUT MISSED IT. §8's own amendment
    # — the ruling that exposed this whole gap — is written as a BLOCKQUOTE, so a
    # matcher anchored to line start could not see it, and the falsification that
    # removed its register row stayed GREEN. Third time today a mutation found a
    # hole in the CHECK rather than in the code.
    secs = list(re.finditer(r'^>?\s*#{2,4}\s+(.*)$', text, re.M))
    for i, m in enumerate(secs):
        body = text[m.end(): secs[i+1].start() if i+1 < len(secs) else len(text)]
        head = m.group(1)
        if not BOARD.search(head + ' ' + body[:600]):
            continue
        found += 1
        ids = sorted(set(ID.findall(head + ' ' + body[:900])))
        if not ids:
            # ⚠️ A SECOND, LARGER DEBT CLASS, AND TODAY'S RULING WAS IN IT. A section
            # that names a board and no item id is UNTRACEABLE: nothing can look it up
            # in a register, so the arm below is blind to it by construction. §8's own
            # amendment carried no id until the gap was found.
            key = f"{pathlib.Path(d).name}|{head[:80]}"
            if key not in known_noid:
                new.append(f"{pathlib.Path(d).name}: \"{head[:70]}\" -> NAMES A BOARD, NAMES NO ITEM ID")
            continue
        if any(x in reg for x in ids):
            continue
        if tuple(ids) in known:
            continue
        new.append(f"{pathlib.Path(d).name}: \"{head[:70]}\" -> {ids}")
if found < 100:
    print(f"  POPULATION COLLAPSED: only {found} board-attributed sections found (expected 140+).")
    print("  The matcher has drifted from the documents and this check is now blind.")
    sys.exit(1)
if new:
    print(f"  {len(new)} board ruling(s) in doctrine with NO row in any ruling register:")
    for n in new[:6]:
        print(f"    {n}")
    print("  A ruling the settled-ground scan cannot read is a ruling that gets re-proposed.")
    print("  Append the row, or add it to lib/plan/__fixtures__/boardRulingRegisterDebt.json WITH A REASON.")
    sys.exit(1)
print(f"  ok  ({found} board-attributed sections; declared debt: {base['unregistered_count']} unregistered, {base['no_id_count']} with no id; 0 new)")
PYEOF
[ "$dfail" = 1 ] && fail=1

say "── board rulings: a RULED item has a register row ──"
# ⚠️ THE GAP THIS CLOSES, AND IT IS THE ONE THE FOUNDER KEEPS FINDING.
#
# `/ship` names THREE documents (backlog, feature-registry, build-log) and this
# audit checks SEVEN surfaces. The four it does not instruct are only ever caught
# after the fact -- which is why "are the docs up to date?" kept being answered
# yes and being wrong.
#
# `design-rulings.md` was in NEITHER. `ship-record-check.py` has a design-ruling
# check, but it fires only when a commit EDITS a doctrine file -- and a ruling
# like "SITE-WAVE-3 is dead" edits no doctrine file at all. So on 2026-09-22 a
# permanent kill lived for hours as a sentence inside a sitting narrative, while
# the state blocks said KILLED and the register the settled-ground scan actually
# READS said nothing. That is precisely the failure the register exists for, and
# this repo has already paid for it twice in one day.
#
# The rule: a backlog heading that announces a board ruling (RULED / DEAD /
# KILLED / VETOED) on an item whose body carries a BOARD TAG must have that
# item's id in the matching ruling register.
rfail=0
python3 - <<'PYEOF' || rfail=1
import re, sys, pathlib
bl = pathlib.Path('docs/releases/backlog.md').read_text(encoding='utf-8')
registers = {
    'DESIGN':   pathlib.Path('docs/canonical/design-rulings.md'),
    'COACHING': pathlib.Path('docs/canonical/coaching-rulings.md'),
}
text = {k: (v.read_text(encoding='utf-8') if v.exists() else '') for k, v in registers.items()}
# ⚠️ ONE OR MORE DIGITS, NOT TWO. The first cut of this check copied
# `ship-record-check.py`'s id pattern, which requires `-\d{2,}` because feature
# ids read `THING-01`. Board ruling ids do not: `SITE-WAVE-3`, `CD-1`, `W-03`.
# So the check reported ALL CLEAN while the very miss it was written for --
# SITE-WAVE-3's absent kill row -- sat in front of it. Caught by falsifying it
# against that exact case rather than trusting the green.
ITEM = re.compile(r'\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)\b')
RULED = re.compile(r'\b(RULED|DEAD|KILLED|VETOED)\b')

lines = bl.split('\n')
heads = [(i, l) for i, l in enumerate(lines) if l.startswith('### ')]
gaps = []
for n, (i, head) in enumerate(heads):
    if not RULED.search(head):
        continue
    ids = ITEM.findall(head)
    if not ids:
        continue
    end = heads[n + 1][0] if n + 1 < len(heads) else len(lines)
    body = '\n'.join(lines[i:end])
    m = re.search(r'\*\*Board:\s*\S*\s*(DESIGN|COACHING)', body)
    if not m:
        continue
    board = m.group(1)
    if ids[0] not in text[board]:
        gaps.append(f"  NO REGISTER ROW {ids[0]} is {RULED.search(head).group(1)} by the {board} board, "
                    f"but its id is absent from {registers[board].name}")
for g in gaps:
    print(g)
sys.exit(1 if gaps else 0)
PYEOF
[ "$rfail" = "1" ] && fail=1 || say "  ok"

say ""
# ⚠️ THE MARKER ADVANCES ONLY ON A CLEAN RUN. A gap therefore stays in scope
# until it is actually fixed, rather than ageing out of the window the way the
# old `--since today` bound let eleven backlog items and one build-log entry do.
# ⚠️ WRITES ONLY WHEN THE VALUE CHANGES. Rewriting unconditionally meant every
# run of a READ-ONLY check dirtied the working tree, so `git status` was never
# clean during a session and a real change could hide behind the churn. A check
# with a side effect on every invocation is a check people stop running.
if [ "$fail" = "0" ] && [ -z "${1:-}" ] && [ "$NO_ADVANCE" = "0" ]; then
  head_sha="$(git rev-parse HEAD)"
  if [ "$MARKER" != "$head_sha" ]; then
    mkdir -p "$(dirname "$MARKER_FILE")"
    printf '%s\n' "$head_sha" > "$MARKER_FILE"
  fi
fi
[ "$fail" = "0" ] && say "ALL CLEAN" || say "GAPS FOUND (above)"
exit $fail
