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
# declared reason is not a fixed problem, and nothing here schedules the 291.
SHIP_RECORD_DEBT_BASELINE=291
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
grep -oE '^\| *`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`? *[—/]' docs/canonical/feature-registry.md \
  | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | sort -u > /tmp/_reg
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
  grep -oE '^### (🔲|🟡|🟠|🟢|🔵|⏸️) `[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`' docs/releases/backlog.md \
    | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
} | sort -u > /tmp/_open
for id in $(comm -12 /tmp/_reg /tmp/_open); do
  say "  STILL OPEN $id (has a feature-registry row)"; afail=1; fail=1
done
[ "$afail" = "0" ] && say "  ok"

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
# ⚠️ FOURTH TIME, and the comment above predicted it while I was writing this
# one. The blockquote-bullet pattern below is only ONE of the two shapes the
# backlog actually uses. Measured 2026-09-21: it matched 19 items while TWENTY
# more sat in `### <emoji> `ID` — ...` heading form, completely unseen — and
# three of those were genuinely open with no roadmap line, two of them
# pre-existing. Both shapes are collected now. Shipped items are filtered out
# below by the registry list, so a heading left behind after a ship does not
# become a false positive.
{
  grep -oE '^> (🔲|🔴|🔴🔴|🔵|⏸️|⚠️) \*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`?[ —–-].*\*\(' docs/releases/backlog.md \
    | grep -oE '\*\*`?[A-Z][A-Z0-9]*(-[A-Z0-9]+)+' | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
  grep -oE '^#{2,4} [^ ]* `[A-Z][A-Z0-9]*(-[A-Z0-9]+)+`' docs/releases/backlog.md \
    | grep -oE '[A-Z][A-Z0-9]*(-[A-Z0-9]+)+'
} | sort -u > /tmp/_openids
while IFS= read -r id; do
  [ -z "$id" ] && continue
  # Shipped items are not open; the registry check above owns those.
  grep -qxF "$id" /tmp/_reg && continue
  grep -qF "$id" docs/releases/roadmap.md || { say "  NO ROADMAP LINE $id (open in backlog.md)"; rfail2=1; fail=1; }
done < /tmp/_openids
[ "$rfail2" = "0" ] && say "  ok"

say "── invariants: code vs plan-invariants.md ──"
grep -oE "'INV-[A-Z0-9-]+'" lib/plan/invariants.ts | tr -d "'" | sort -u > /tmp/_a
grep -oE '^\| `INV-[A-Z0-9-]+`' docs/canonical/plan-invariants.md | grep -oE 'INV-[A-Z0-9-]+' | sort -u > /tmp/_b
d=$(comm -3 /tmp/_a /tmp/_b | wc -l | tr -d ' ')
say "  code=$(wc -l < /tmp/_a | tr -d ' ') doc=$(wc -l < /tmp/_b | tr -d ' ') orphans=$d"
[ "$d" != "0" ] && { comm -3 /tmp/_a /tmp/_b | sed 's/^/    /'; fail=1; }

# SINGLE OWNER of "is this route documented?" — used by BOTH the per-change arm
# and the standing-debt count, so the two can never drift (the producer/checker
# split this repo has paid for repeatedly).
contracted() {
  local rf="$1" nm rp
  nm=$(printf '%s' "$rf" | sed -E 's#^app/api/##; s#/route\.tsx?$##; s#/#-#g')
  [ -f "docs/contracts/api/${nm}.md" ] && return 0
  rp=$(printf '%s' "$rf" | sed -E 's#^app/##; s#/route\.tsx?$##')
  grep -rqF "$rp" docs/contracts/api/ 2>/dev/null && return 0
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
  stale=$(grep '^\*\*State at \(end\|END\) of' "$f" | grep -vc "$last" || true)
  if [ "$stale" != "0" ]; then
    say "  STALE $f: $stale of $blocks state paragraph(s) do not name last ship $last"; sfail=1; fail=1
  fi
done
[ -f "$mem" ] && { grep -q "$last" "$mem" || { say "  STALE MEMORY.md does not name last ship $last"; sfail=1; fail=1; }; }
[ "$sfail" = "0" ] && say "  ok"

say ""
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
