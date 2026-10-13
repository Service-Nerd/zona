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

# ── documentation: the case counts CLAUDE.md quotes must be the real ones ────
# ⚠️ WHY. When this runner was written, CLAUDE.md's hook section claimed
# coaching-guard ran 50 cases and design-guard 67. They run 56 and 72. Nobody
# wrote a wrong number: cases were added and the prose was not revisited, which
# is the whole documented-but-drifting class this repo keeps paying for. The
# counts are worth quoting -- they are what makes the section concrete -- so the
# answer is not to delete them but to make them checkable.
# A number in a doc drifts; a number a script checks does not.
DOC="$ROOT/CLAUDE.md"
if [ -f "$DOC" ]; then
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    hook="${pair%%=*}"; real="${pair##*=}"
    # No backticks or asterisks in the pattern: the prose around the number uses
    # a mix of `code spans`, em dashes and **bold**, and matching them literally
    # is both fragile and a quoting minefield. Span whatever sits between the
    # filename and the number instead.
    claim="$(grep -oE "${hook}\.test\.py[^0-9]{0,24}[0-9]+ cases" "$DOC" \
             | grep -oE '[0-9]+ cases' | grep -oE '[0-9]+' | head -1)"
    [ -n "$claim" ] || continue          # not every hook quotes a count, and that is fine
    [ "$real" = "-" ] && continue        # the suite states no total; nothing to compare
    checked=$((checked + 1))
    if [ "$claim" != "$real" ]; then
      drifted+=("$hook: CLAUDE.md says $claim, the suite runs $real")
    fi
  done <<< "$counts"
fi

if [ ${#drifted[@]} -gt 0 ]; then
  echo
  echo "CLAUDE.md QUOTES A STALE CASE COUNT (${#drifted[@]}):"
  for d in "${drifted[@]}"; do echo "  ✗ $d"; done
  echo "  Update the number in CLAUDE.md § Claude Code Hooks, or remove the claim."
fi

echo
echo "$hooks hooks · $suites suites · $cases_total+ cases · ${#missing[@]} untested · ${#failed[@]} failing · $checked doc counts checked, ${#drifted[@]} drifted"

if [ ${#missing[@]} -gt 0 ] || [ ${#failed[@]} -gt 0 ] || [ ${#drifted[@]} -gt 0 ]; then
  echo "HOOK TESTS: GAPS FOUND (above)"
  exit 1
fi
echo "HOOK TESTS: ALL CLEAN"
exit 0
