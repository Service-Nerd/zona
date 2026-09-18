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
SINCE="${1:-$(date +%Y-%m-%d)}"
fail=0
say() { printf '%s\n' "$*"; }

say "── ship records (feat/fix scopes since $SINCE) ──"
ids=$(git log --since="$SINCE 00:00" --pretty=format:"%s" \
      | grep -oE "^(feat|fix)\([A-Z0-9-]+\)" | grep -oE "\([A-Z0-9-]+\)" | tr -d '()' | sort -u)
for id in $ids; do
  r=$(grep -c "^| $id " docs/canonical/feature-registry.md || true)
  b=$(grep -c "^## .*$id" docs/build-log.md || true)
  if [ "$r" = "0" ] || [ "$b" = "0" ]; then say "  GAP $id registry=$r buildlog=$b"; fail=1; rfail=1; fi
done
[ "${rfail:-0}" = "0" ] && say "  ok"

say "── invariants: code vs plan-invariants.md ──"
grep -oE "'INV-[A-Z0-9-]+'" lib/plan/invariants.ts | tr -d "'" | sort -u > /tmp/_a
grep -oE '^\| `INV-[A-Z0-9-]+`' docs/canonical/plan-invariants.md | grep -oE 'INV-[A-Z0-9-]+' | sort -u > /tmp/_b
d=$(comm -3 /tmp/_a /tmp/_b | wc -l | tr -d ' ')
say "  code=$(wc -l < /tmp/_a | tr -d ' ') doc=$(wc -l < /tmp/_b | tr -d ' ') orphans=$d"
[ "$d" != "0" ] && { comm -3 /tmp/_a /tmp/_b | sed 's/^/    /'; fail=1; }

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
  [ -f "$c" ] || continue
  touched | grep -qx "$c" || { say "  STALE $c (route changed, contract did not)"; cfail=1; fail=1; }
done
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

say "── state blocks name the last SHIP ──"
last=$(git log --pretty=format:'%h %s' | grep -E '^[a-f0-9]+ (feat|fix)\(' | head -1 | cut -d' ' -f1)
mem="$HOME/.claude/projects/$(pwd | tr '/' '-')/memory/MEMORY.md"
sfail=0
for f in docs/releases/backlog.md docs/releases/roadmap.md; do
  grep -q "$last" "$f" || { say "  STALE $f does not name last ship $last"; sfail=1; fail=1; }
done
[ -f "$mem" ] && { grep -q "$last" "$mem" || { say "  STALE MEMORY.md does not name last ship $last"; sfail=1; fail=1; }; }
[ "$sfail" = "0" ] && say "  ok"

say ""
[ "$fail" = "0" ] && say "ALL CLEAN" || say "GAPS FOUND (above)"
exit $fail
