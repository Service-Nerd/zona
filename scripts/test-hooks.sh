#!/usr/bin/env bash
# Run every Claude Code hook's test suite, and fail if a hook has none.
#
# 🔴 WHY THIS EXISTS. Measured 2026-10-13 while closing HOOK-TEST-FIXTEST-01:
# nine of the eleven hooks under `.claude/hooks/` carried a `.test.py` — 72
# cases, 56, 29, 25, 14, 12 — and NOTHING RAN ANY OF THEM. No npm script, no CI
# job, no git hook. `verify:hooks` is eslint over app code; `test:githooks` is
# the shell pre-commit only. So eight hundred-odd assertions guarding the
# repo's own guard rails executed exactly when somebody remembered to type the
# filename, and this repo's record is unambiguous about what that is worth:
# a check that depends on remembering is a check that does not run.
#
# ⚠️ THE POPULATION IS GLOBBED, NEVER LISTED. A hand-written list of hooks is
# correct on the day it is typed and silently short from the day hook twelve
# lands — and "the checker's population excludes the cases at risk" is a class
# this repo recorded FOUR times in one week (sheetClose.test.ts's four
# hand-typed paths; buttonGeometry's arm reading a set that was pre-filtered to
# the already-compliant). The coverage arm below exists so the next hook has to
# prove itself on the way in rather than being added to a list by hand.
#
# Exit 1 if any hook lacks a suite, or any suite fails.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$ROOT/.claude/hooks"

missing=()
failed=()
drifted=()
uncounted=()
dropped=()
checked=0
counts=""
suites=0
hooks=0

shopt -s nullglob
for hook in "$HOOKS"/*.py; do
  base="$(basename "$hook" .py)"
  case "$base" in *.test) continue ;; esac
  hooks=$((hooks + 1))
  if [ ! -f "$HOOKS/$base.test.py" ]; then
    missing+=("$base")
  fi
done

# ── coverage: every hook must carry a suite ──────────────────────────────────
if [ ${#missing[@]} -gt 0 ]; then
  echo "HOOKS WITH NO TESTS (${#missing[@]} of $hooks):"
  for m in "${missing[@]}"; do echo "  ✗ .claude/hooks/$m.py"; done
  echo
  echo "A hook is a guard rail. An untested guard rail is a claim."
  echo "Write .claude/hooks/<name>.test.py — both directions, because the cases"
  echo "where a hook must stay SILENT are what stop it being switched off."
fi

# ── how many cases did a suite run? ──────────────────────────────────────────
#
# 🔴 AND A SUITE THAT STATES NO TOTAL IS NOW A FAILURE (HOOK-SUITE-HOLLOW-01, 2026-11-08).
# This runner proved two things: every hook has a suite, and every suite exits 0. It could
# not prove a suite ASSERTS ANYTHING. `ship-record-check.test.py` printed `all checks
# passed` with no count, so the runner honestly reported `- cases` for it — and a suite
# reduced to `print("all checks passed")` would have passed identically. **Unverified is
# never a pass**, which is the rule `verify-cap-config.mjs` already holds for an arm it
# cannot evaluate.
#
# ⚠️ THE ITEM SAID STANDARDISING FIVE OUTPUT FORMATS WAS THE BULK OF THE WORK. Re-measured
# 2026-11-08: **10 of 11 suites already state a total.** Exactly one did not. The formats
# did not need standardising; the one silent suite needed a counter and the runner needed to
# stop treating silence as success.
#
# ⚠️ AND THE REPO'S HOLLOW-CHECK LINT CANNOT REACH HERE. `lib/hollowTestShapes.test.ts` lints
# vitest TypeScript; these are Python scripts, outside its glob by construction. So the one
# category of test this repo has measured as hollow fifteen times is the category with no
# lint over it. The case-count ratchet below is the substitute: a gutted suite cannot hide,
# because its number has to go down.
# ⚠️ THE SUITES DO NOT AGREE ON A FORMAT and this runner must not pretend they
# do. Five conventions are in use: "N cases, 0 failure(s)", "N/N passed",
# "0 failure(s)", "all checks passed", and per-line PASS marks. The first cut
# of this function grepped for one of them and printed "0 cases" against
# design-guard, which runs 72 — and a count that reads 0 when the answer is 72
# is worse than no count, because it reads as an empty suite rather than an
# unparsed one. So: take the suite's OWN stated total where it states one,
# count per-case marks where it does not, and print "—" rather than a zero.
count_cases() {
  local out="$1" n=""
  n="$(printf '%s\n' "$out" | grep -oE '[0-9]+ cases' | tail -1 | grep -oE '[0-9]+')"
  [ -n "$n" ] || n="$(printf '%s\n' "$out" | grep -oE '[0-9]+/[0-9]+ passed' | tail -1 | grep -oE '^[0-9]+')"
  [ -n "$n" ] || n="$(printf '%s\n' "$out" | grep -cE '^[[:space:]]*(✓|PASS|ok )')"
  if [ "${n:-0}" -gt 0 ] 2>/dev/null; then printf '%s' "$n"; else printf '%s' '-'; fi
}

# ── execution: every suite must pass ─────────────────────────────────────────
cases_total=0
for suite in "$HOOKS"/*.test.py; do
  suites=$((suites + 1))
  name="$(basename "$suite")"
  if out="$(python3 "$suite" 2>&1)"; then
    n="$(count_cases "$out")"
    [ "$n" = "-" ] || cases_total=$((cases_total + n))
    # bash 3.2 ships on macOS, so no associative arrays: a flat "name=N" list.
    counts="$counts$(basename "$suite" .test.py)=$n
"
    printf '  ✓ %-34s %s cases\n' "$name" "$n"
  else
    failed+=("$name")
    printf '  ✗ %-34s FAILED\n' "$name"
    echo "$out" | sed 's/^/      /'
  fi
done
shopt -u nullglob

# ── a suite that states no total is UNVERIFIED, and unverified is not a pass ─
while IFS= read -r pair; do
  [ -n "$pair" ] || continue
  if [ "${pair##*=}" = "-" ]; then uncounted+=("${pair%%=*}"); fi
done <<< "$counts"

if [ ${#uncounted[@]} -gt 0 ]; then
  echo
  echo "SUITES THAT STATE NO CASE TOTAL (${#uncounted[@]}):"
  for u in "${uncounted[@]}"; do echo "  ✗ .claude/hooks/$u.test.py"; done
  echo "  A suite the runner cannot count is a suite the runner cannot tell from an empty one."
  echo "  Print a total it can read: \"N cases, 0 failure(s)\" or \"N/N passed\"."
fi

# ── the RATCHET: a case count may rise, and may not silently fall ────────────
#
# 🔑 The cheap defence against a gutted suite is not a linter, it is the number. A suite
# reduced to one assertion still exits 0 and still prints a total; what it cannot do is
# keep the SAME total. Same debt-register shape as `SWEEP-BASELINE-01`, the liveness
# baseline and `cohort:shape`: the file is the declaration, and lowering it is a statement
# you make on purpose, in a commit, with a reason.
BASELINE="$ROOT/.claude/hooks/case-counts.txt"
if [ -n "${HOOK_CASE_BASELINE:-}" ]; then BASELINE="$HOOK_CASE_BASELINE"; fi
# 🔴 `--write` IS DEFERRED TO THE END (code review round 8). It used to run HERE and exit,
# which is before both documentation arms — so the "refusing to re-baseline: this run is not
# green" gate could not see `drifted` or a suite that failed while being counted, and a run
# that printed GAPS FOUND / exit 1 without it printed "rewritten from this run" / exit 0 with
# it. The one path that can delete a guard must see every arm.
WRITE=0
[ "${1:-}" = "--write" ] && WRITE=1
if [ "$WRITE" = 0 ] && [ -f "$BASELINE" ]; then
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    hook="${pair%%=*}"; was="${pair##*=}"
    now="$(printf '%s' "$counts" | grep "^${hook}=" | head -1 | sed 's/.*=//')"
    if [ -z "$now" ]; then
      dropped+=("$hook: baselined at $was cases, suite is GONE")
    elif [ "$now" = "-" ] || [ "$was" = "-" ]; then
      :                                    # the uncounted arm above owns this case
    elif [ "$now" -lt "$was" ] 2>/dev/null; then
      dropped+=("$hook: was $was cases, now $now — cases were REMOVED")
    fi
  done < "$BASELINE"
fi

if [ ${#dropped[@]} -gt 0 ]; then
  echo
  echo "A HOOK SUITE LOST CASES (${#dropped[@]}):"
  for d in "${dropped[@]}"; do echo "  ✗ $d"; done
  echo "  If the removal is deliberate: npm run test:hooks -- --write, and say why in the commit."
fi

# ── documentation: the case counts CLAUDE.md quotes must be the real ones ────
# ⚠️ WHY. When this runner was written, CLAUDE.md's hook section claimed
# coaching-guard ran 50 cases and design-guard 67. They run 56 and 72. Nobody
# wrote a wrong number: cases were added and the prose was not revisited, which
# is the whole documented-but-drifting class this repo keeps paying for. The
# counts are worth quoting -- they are what makes the section concrete -- so the
# answer is not to delete them but to make them checkable.
# A number in a doc drifts; a number a script checks does not.
DOC="$ROOT/CLAUDE.md"
# ⚠️ ANCHORED TO $ROOT, not to the cwd: a cwd-relative glob in a $ROOT-anchored script either
# aborts under `set -u` or, on bash >= 4.4, checks NOTHING and prints ALL CLEAN. And an empty
# population is a refusal, because selecting nothing is this repo's most-recorded hollow pass.
shell_suites=()
while IFS= read -r f; do shell_suites+=("${f#"$ROOT/"}"); done < <(
  ls "$ROOT"/.githooks/*.test.sh "$ROOT"/scripts/*.test.sh "$ROOT"/scripts/lib/*.test.py 2>/dev/null | sort -u)
if [ ${#shell_suites[@]} -eq 0 ]; then
  echo "DOC COUNT ARM SELECTED NO SUITES — refusing to report clean."
  exit 1
fi
# ⚠️ ATTRIBUTION NEEDS EVERY SUITE NAME, not only this arm's. The python hooks' suites are
# named in the same prose, and without them a count beside `coaching-guard.test.py` is
# attributed to whichever SHELL suite happens to be nearest.
shell_bases=()
for suite in "${shell_suites[@]}"; do shell_bases+=("$(basename "$suite")"); done
# ⚠️ AND EVERY SUITE CARRIES ITS SUBJECT'S NAME AS AN ALIAS (code review round 9). Three
# bullets count a suite as `Tests: N cases.` on a line that names only `<hook>.py`, so the
# claim bound to nothing and the arm read "no claim" and skipped it — the comment said that
# is fine, and for those three it was false. 17 claims in the doc, 12 checked.
all_bases=()
for b in "${shell_bases[@]}"; do all_bases+=("$b" "${b/.test./.}"); done
for h in "$ROOT"/.claude/hooks/*.test.py; do
  [ -f "$h" ] || continue
  b="$(basename "$h")"; all_bases+=("$b" "${b/.test./.}")
done


# 🔴 ONE ATTRIBUTION OWNER FOR BOTH ARMS (code review round 8). The python arm kept its own
# `head -1` regex, so a SECOND count for the same suite elsewhere in the doc was never
# compared — CLAUDE.md could state two and the runner reported clean. Both arms call this.
# ⚠️ The helper's exit status is CHECKED: an empty result from a broken helper is
# indistinguishable from "no claim", and a silent `continue` drops the suite from the arm.
# 🔴 IT RETURNS THE STATUS; IT DOES NOT `exit`. The first cut exited here — inside a command
# substitution, so it killed the SUBSHELL only: a helper broken to fail on every call printed
# "refusing to report clean" twelve times and the runner still exited 0 with ALL CLEAN. An arm
# that cannot stop the run is not an arm. Callers must use `claims="$(doc_claims X)" || ...`.
doc_claims() {
  python3 "$ROOT/scripts/lib/doc-case-count.py" "$DOC" "$1" "${all_bases[@]}"
}
doc_claims_failed() {
  echo
  echo "doc-case-count.py FAILED for $1 — refusing to report clean."
  echo "  An attribution that cannot run leaves every documented count unchecked."
  exit 1
}

if [ -f "$DOC" ]; then
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    hook="${pair%%=*}"; real="${pair##*=}"
    # No backticks or asterisks in the pattern: the prose around the number uses
    # a mix of `code spans`, em dashes and **bold**, and matching them literally
    # is both fragile and a quoting minefield. Span whatever sits between the
    # filename and the number instead.
    claims="$(doc_claims "${hook}.test.py,${hook}.py")" || doc_claims_failed "${hook}.test.py"
    [ -n "$claims" ] || continue         # not every hook quotes a count, and that is fine
    [ "$real" = "-" ] && continue        # the suite states no total; nothing to compare
    if [ "$(printf '%s\n' "$claims" | wc -l | tr -d ' ')" != 1 ]; then
      drifted+=("$hook: CLAUDE.md quotes more than one case count for it ($(printf '%s' "$claims" | tr '\n' '/'))")
      continue
    fi
    checked=$((checked + 1))
    if [ "$claims" != "$real" ]; then
      drifted+=("$hook: CLAUDE.md says $claims, the suite runs $real")
    fi
  done <<< "$counts"
fi

# ── the SHELL suites quote counts in CLAUDE.md too, and nothing read them ────
#
# 🔴 Measured by code review, 2026-11-08: CLAUDE.md said `.githooks/pre-commit.test.sh` runs
# **11 cases** while the line directly below it (edited in the same commit) said 14, and the
# suite runs 14. The doc-count arm above reads `.claude/hooks/*.test.py` ONLY, so neither shell
# suite's number was ever compared against anything. **A number in a doc drifts; a number a
# script checks does not** — the same sentence this file already carries, applied to the
# population it had left out.
# 🔴 THE POPULATION IS GLOBBED, NEVER LISTED (code review round 6). It was a hand-typed list
# of three against SEVEN such suites on disk, so `strip-comments.test.py` — added in the same
# commit as its own documented count — was checked by nothing, which is the shape this file
# exists to refuse.
skipped=(); shell_failed=(); shell_uncounted=()
for suite in "${shell_suites[@]}"; do
  base="$(basename "$suite")"
  claims="$(doc_claims "$base,${base/.test./.}")" || doc_claims_failed "$base"
  [ -n "$claims" ] || continue
  if [ "$(printf '%s\n' "$claims" | wc -l | tr -d ' ')" != 1 ]; then
    drifted+=("$base: CLAUDE.md quotes more than one case count for it ($(printf '%s' "$claims" | tr '\n' '/'))")
    continue
  fi
  claim="$claims"
  # 🔴 THE EXIT CODE IS NOT DISCARDED. It was: a suite printing `16 cases, 3 failed` still had
  # its 16 read and `test-hooks.sh` reported ALL CLEAN over a failing suite.
  rc=0
  case "$suite" in
    *.py) out="$(python3 "$ROOT/$suite" 2>&1)" || rc=$?;;
    *)    out="$(bash "$ROOT/$suite" 2>&1)" || rc=$?;;
  esac
  [ "$rc" -eq 0 ] || shell_failed+=("$suite")
  real="$(printf '%s' "$out" | grep -oE '[0-9]+ (passed|cases)' | grep -oE '[0-9]+' | tail -1)"
  # ⚠️ A suite that SKIPS here has not been measured — it is not a pass and not a drift.
  if [ -z "$real" ] && printf '%s' "$out" | grep -q '^SKIP'; then skipped+=("$base"); continue; fi
  [ -n "$real" ] || { shell_uncounted+=("$suite"); continue; }
  checked=$((checked + 1))
  [ "$claim" = "$real" ] || drifted+=("$base: CLAUDE.md says $claim, the suite runs $real")
done

if [ ${#skipped[@]} -gt 0 ]; then
  echo "DOC COUNT NOT MEASURED HERE (${#skipped[@]}): ${skipped[*]} — the suite skipped in this environment."
fi

# 🔴 THE SHELL ARM GETS ITS OWN REPORT, because the blocks above it have already run by the
# time it adds an entry — so a suite landing in `uncounted` here used to fail the run with
# NOTHING above naming the cause. They are folded into the global arrays after printing, so
# the summary line and the exit code count them.
if [ ${#shell_failed[@]} -gt 0 ]; then
  echo
  echo "SUITES THAT FAILED WHILE BEING COUNTED (${#shell_failed[@]}):"
  for f in "${shell_failed[@]}"; do echo "  ✗ $f"; done
  echo "  Its printed total is not a verdict. Run it directly."
fi
if [ ${#shell_uncounted[@]} -gt 0 ]; then
  echo
  echo "SUITES THAT STATE NO CASE TOTAL (${#shell_uncounted[@]}):"
  for u in "${shell_uncounted[@]}"; do echo "  ✗ $u"; done
  echo "  Print a total this runner can read: \"N cases, 0 failed\" or \"N passed\"."
fi
# ⚠️ Guarded: under `set -u`, bash 3.2 (this Mac) treats an EMPTY array expansion as unbound.
[ ${#shell_failed[@]} -eq 0 ] || failed+=("${shell_failed[@]}")
[ ${#shell_uncounted[@]} -eq 0 ] || uncounted+=("${shell_uncounted[@]}")

if [ ${#drifted[@]} -gt 0 ]; then
  echo
  echo "CLAUDE.md QUOTES A STALE CASE COUNT (${#drifted[@]}):"
  for d in "${drifted[@]}"; do echo "  ✗ $d"; done
  echo "  Update the number in CLAUDE.md § Claude Code Hooks, or remove the claim."
fi

echo
# 🔴 WHAT BINDS TO NOTHING, PRINTED. An unattributable claim used to be read as "no claim"
# and skipped in silence, which is how three documented counts went unchecked. ⚠️ Not a
# failure: an AGGREGATE ("351 cases in all") legitimately belongs to no single suite, so a
# gate here would fire on correct prose. It is listed so the number is visible.
if [ ! -f "$DOC" ]; then
  echo "$DOC is missing — refusing to report clean on documented counts."
  exit 1
fi
unattr="$(python3 "$ROOT/scripts/lib/doc-case-count.py" --unattributed "$DOC" "${all_bases[@]}")" \
  || doc_claims_failed "--unattributed"
unattr_n=0
[ -z "$unattr" ] || unattr_n="$(printf '%s\n' "$unattr" | wc -l | tr -d ' ')"
if [ "$unattr_n" -gt 0 ]; then
  echo
  echo "DOC COUNTS BINDING TO NO SUITE ($unattr_n) — not a failure, but not checked either:"
  printf '%s\n' "$unattr" | sed 's/^/  · /'
fi

# ⚠️ THE WRITE HAPPENS HERE, after every arm has had its say.
if [ "$WRITE" = 1 ]; then
  # 🔴 `--write` MUST REFUSE A RUN THAT IS NOT GREEN (code review, 2026-11-08). The first cut
  # wrote unconditionally and exited 0, so `--write` on a run with a FAILING suite printed
  # `✗ … FAILED`, returned success, and wrote a baseline with that suite's row MISSING, which
  # permanently disarms the "suite is GONE" arm for it. **The escape hatch was the one path
  # that could silently delete a guard.** `drifted` is in the condition since round 8.
  if [ ${#failed[@]} -gt 0 ] || [ ${#missing[@]} -gt 0 ] || [ ${#uncounted[@]} -gt 0 ] \
     || [ ${#drifted[@]} -gt 0 ]; then
    echo
    echo "REFUSING TO RE-BASELINE: this run is not green."
    echo "  ${#failed[@]} failing · ${#missing[@]} untested · ${#uncounted[@]} uncounted · ${#drifted[@]} drifted"
    echo "  A baseline written from a broken run omits the broken suites, which disarms the"
    echo "  ratchet for exactly the suites that need it. Fix the run, then --write."
    exit 1
  fi
  printf '%s' "$counts" | grep . | sort > "$BASELINE"
  echo
  echo "case-counts.txt rewritten from this run ($(grep -c . "$BASELINE") suites)."
  echo "Say in the commit which number moved and why. Never re-baseline to turn this green."
  exit 0
fi

echo "$hooks hooks · $suites suites · $cases_total cases · ${#missing[@]} untested · ${#failed[@]} failing · ${#uncounted[@]} uncounted · ${#dropped[@]} shrunk · $checked doc counts checked, ${#drifted[@]} drifted, $unattr_n unattributed"

if [ ${#missing[@]} -gt 0 ] || [ ${#failed[@]} -gt 0 ] || [ ${#drifted[@]} -gt 0 ] \
   || [ ${#uncounted[@]} -gt 0 ] || [ ${#dropped[@]} -gt 0 ]; then
  echo "HOOK TESTS: GAPS FOUND (above)"
  exit 1
fi
echo "HOOK TESTS: ALL CLEAN"
exit 0
