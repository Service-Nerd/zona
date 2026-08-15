#!/usr/bin/env bash
# SessionStart context hook.
# Stdout is injected into the session as ambient context, so keep it terse.
# Purpose: orient the session with date + recent commits, and — the part that
# earns its keep — surface Supabase migration files that haven't been marked
# applied. Two of our worst silent outages (avg_temp_c, calories_kcal) were
# migration files that sat unapplied for days while ingest broke invisibly.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

LEDGER=".claude/state/applied-migrations.txt"
MIG_DIR="supabase/migrations"

echo "── Session context ──────────────────────────────"
echo "Date: $(date '+%Y-%m-%d %H:%M %Z')"
echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"

echo "Recent commits:"
git log -3 --pretty='  %h %s' 2>/dev/null || true

# Uncommitted-change count (cheap situational awareness).
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
[ "$DIRTY" != "0" ] && echo "Working tree: $DIRTY uncommitted path(s)"

# Unapplied-migration check. A migration file is considered applied once its
# basename is listed in the ledger. New files not in the ledger are flagged.
if [ -d "$MIG_DIR" ]; then
  touch "$LEDGER"
  UNAPPLIED=""
  for f in "$MIG_DIR"/*.sql; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    grep -qxF "$base" "$LEDGER" || UNAPPLIED="$UNAPPLIED  $base
"
  done
  if [ -n "$UNAPPLIED" ]; then
    echo ""
    echo "⚠️  MIGRATION(S) NOT MARKED APPLIED — verify they ran against Supabase"
    echo "   (project wkppmpsvqkaxbekdgzdm) before trusting related features:"
    printf '%s' "$UNAPPLIED"
    echo "   After applying, append the filename to $LEDGER."
  fi
fi

# Coaching-doctrine check. Catches a doctrine change already in flight from a
# previous session, which the PreToolUse guard (coaching-guard.py) can't see
# because the edit already happened. Same failure class as the migration check:
# a change that is live but never went through review.
DOCTRINE=$(git status --porcelain 2>/dev/null | grep -E \
  'docs/canonical/(CoachingPrinciples|session-catalogue|zone-rules|coaching-rules)\.md|lib/plan/(generationConfig|planSignatures|sessionFormat)\.ts' \
  | sed 's/^/  /' || true)
if [ -n "$DOCTRINE" ]; then
  echo ""
  echo "⚖️  UNCOMMITTED COACHING-DOCTRINE CHANGE(S):"
  printf '%s\n' "$DOCTRINE"
  echo "   These change what the engine prescribes. Confirm a Coaching Board"
  echo "   review ruled on them (/coaching-board) and that all three artifacts"
  echo "   landed — principle §, GENERATION_CONFIG constant, validatePlan()"
  echo "   invariant. See ADR-017."
fi
echo "─────────────────────────────────────────────────"
