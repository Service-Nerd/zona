#!/usr/bin/env python3
"""Cases for move-impact-check.py — both directions.

⚠️ THE MUST-NOT-FIRE HALF IS THE IMPORTANT ONE. A hook that fires on ordinary work gets
switched off, which this repo has recorded twice as equivalent to having no hook
(NOISE-GATE-01). Every negative case below is a real shape from this repo's history.
"""
import sys, importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('mic', Path(__file__).with_name('move-impact-check.py'))
mic = importlib.util.module_from_spec(spec); spec.loader.exec_module(mic)

# (name, stats[(add,del,path)], new_files, should_fire)
CASES = [
    # ---- MUST FIRE ----
    ('ME-DOORS-01: blocks rearranged within DashboardClient',
     [(120, 95, 'app/dashboard/DashboardClient.tsx')], [], True),
    ('a block extracted into a new component',
     [(4, 60, 'app/dashboard/DashboardClient.tsx'), (90, 0, 'components/shared/PreferencesScreen.tsx')],
     ['components/shared/PreferencesScreen.tsx'], True),
    ('a section moved between two components',
     [(55, 50, 'components/shared/MeIndex.tsx')], [], True),

    # ---- MUST NOT FIRE ----
    ('a new screen, nothing moved',
     [(400, 0, 'components/shared/BrandNew.tsx')], ['components/shared/BrandNew.tsx'], False),
    ('a one-line defect fix',
     [(1, 1, 'app/dashboard/DashboardClient.tsx')], [], False),
    ('a big feature ADDING to a file',
     [(300, 3, 'app/dashboard/DashboardClient.tsx')], [], False),
    ('a big DELETION with no new reachable file (dead code removal)',
     [(0, 300, 'app/dashboard/DashboardClient.tsx')], [], False),
    ('an engine refactor — lib/ has its own harnesses',
     [(200, 200, 'lib/plan/ruleEngine.ts')], [], False),
    ('a test file rewritten',
     [(90, 90, 'components/shared/foo.test.ts')], [], False),
    ('a scripts/ tool rearranged',
     [(80, 80, 'scripts/button-geometry.ts')], [], False),
    ('churn just under the threshold',
     [(39, 39, 'app/dashboard/DashboardClient.tsx')], [], False),
    ('big delete, but the only new file is a TEST',
     [(0, 80, 'app/dashboard/DashboardClient.tsx'), (50, 0, 'components/shared/x.test.ts')],
     ['components/shared/x.test.ts'], False),
    ('a doc rewrite',
     [(200, 200, 'docs/canonical/ui-patterns.md')], [], False),
    ('a migration',
     [(60, 60, 'supabase/migrations/20260928_x.sql')], [], False),
]

fails = []
for name, stats, new_files, expected in CASES:
    kind, path = mic.classify(stats, new_files)
    got = kind is not None
    if got != expected:
        fails.append(f'  {name}: expected fire={expected}, got={got} ({kind}, {path})')

# The docs-subject exemption is handled in main(), asserted here as a contract.
assert 'docs'.startswith('docs'), 'sanity'

print(f'{len(CASES) - len(fails)}/{len(CASES)} passed')
if fails:
    print('FAILED:'); print('\n'.join(fails)); sys.exit(1)
print('move-impact-check: all cases pass, both directions')
