#!/usr/bin/env python3
"""Tests for backlog-touch.py. Run: python3 .claude/hooks/backlog-touch.test.py

Two things must hold, and the second is the one the 2026-08-15 audit exposed:
  1. A commit touching a file an open entry names produces a hit.
  2. All THREE backlog item formats are parsed. A bullet-only parser silently
     misses ~40% of open items — that is exactly how CA-08 appeared to have
     dropped out of the backlog.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bt", os.path.join(HERE, "backlog-touch.py"))
bt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bt)

SAMPLE = """
## NEXT

- 🔲 **[W6]** **PUSH-UNITS-01 — daily push must honour the unit** — `buildDailyPushTitle` in
  `lib/coaching/voiceLines.ts` is called with a hardcoded unit. Fix in
  `app/api/push/send-daily/route.ts`.
- 🔲 **[W6]** **FMT-02 — StravaPanel hardcoded km** — `components/strava/StravaPanel.tsx` tiles.
- ✅ **[W6]** **FMT-03 — dead SessionHero** — removed from `app/dashboard/DashboardClient.tsx`.
- 🔲 **[W5]** **NO-FILES — a strategy item** with no file references at all.
- 🔲 **[W6]** **FMT-01 — prompts** — `lib/coaching/prompts/{sessionReframe,weeklyReport}.ts`.

### LATER

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **CA-08** · **[W4]** | **Garmin Connect** — reuses `lib/coaching/healthkitConsolidate.ts`. | PAID | M | note |

### Scoped but unscheduled

- **[W5]** **Zone method selector** — stored via `lib/plan/generationConfig.ts`. PAID
"""

ITEMS = dict(bt.parse_items(SAMPLE))


def check(desc, cond):
    print(('✓ ' if cond else '✗ ') + desc)
    return 0 if cond else 1


fails = 0

# --- format coverage: the audit finding ---
fails += check('parses status-bullet items',        'PUSH-UNITS-01' in ITEMS)
fails += check('parses LATER TABLE rows (CA-08)',   'CA-08' in ITEMS)
fails += check('parses unscheduled bullets',        'Zone method selector' in ITEMS)
fails += check('skips shipped (✅) items',           'FMT-03' not in ITEMS)
fails += check('drops items with no file refs',     'NO-FILES' not in ITEMS)

# --- path extraction ---
fails += check('collects multiple paths per item',
               ITEMS.get('PUSH-UNITS-01') == {
                   'lib/coaching/voiceLines.ts', 'app/api/push/send-daily/route.ts'})
fails += check('expands brace lists',
               ITEMS.get('FMT-01') == {
                   'lib/coaching/prompts/sessionReframe.ts',
                   'lib/coaching/prompts/weeklyReport.ts'})
fails += check('picks paths out of table rows',
               ITEMS.get('CA-08') == {'lib/coaching/healthkitConsolidate.ts'})

# --- matching ---
fails += check('exact path matches',
               bt.touches('lib/coaching/voiceLines.ts', 'lib/coaching/voiceLines.ts'))
fails += check('bare filename does NOT match a full path (too loose)',
               not bt.touches('voiceLines.ts', 'lib/coaching/voiceLines.ts'))
fails += check('unrelated path does not match',
               not bt.touches('app/dashboard/DashboardClient.tsx', 'lib/coaching/voiceLines.ts'))
fails += check('substring near-miss does not match',
               not bt.touches('lib/coaching/voiceLines2.ts', 'lib/coaching/voiceLines.ts'))

# --- the regression this hook exists to catch ---
changed = ['lib/coaching/voiceLines.ts', 'lib/format.ts']
hit = any(any(bt.touches(c, p) for c in changed for p in paths)
          for label, paths in [('PUSH-UNITS-01', ITEMS['PUSH-UNITS-01'])])
fails += check('the PUSH-UNITS-01 scenario is caught', hit)

print()
print(f'{fails} failure(s)')
sys.exit(1 if fails else 0)
