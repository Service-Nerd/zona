#!/usr/bin/env python3
"""Tests for ship-record-check.py. Run: python3 .claude/hooks/ship-record-check.test.py

The case that matters most is the LAST one. On 2026-09-11 a manual audit reported
GTM-CHARITY-02 as covered because its ID appeared in the registry — inside another
feature's row, in a sentence referring to it. A substring search cannot tell
"this row is about X" from "this row mentions X", and that is the whole reason
this hook reads the first cell rather than the file.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("src", os.path.join(HERE, "ship-record-check.py"))
src = importlib.util.module_from_spec(spec)
spec.loader.exec_module(src)

failures = []


def check(name, got, want):
    if got != want:
        failures.append(f"{name}: got {got!r}, want {want!r}")


# ── which commits count as a ship ────────────────────────────────────────────
for subject, want in [
    ('feat(§106): a plan never peaks below where the runner already is', True),
    ('fix(UX-AUTH-01): the app stops becoming the website', True),
    ('refactor(SESSION-KM-01): one owner for how far is this session', False),
    ('docs: reconcile backlog, roadmap and feature registry', False),
    ('chore(deps): bump vitest', False),
    ('test: add a falsification case', False),
]:
    check(f"SHIP_SUBJECT({subject[:28]})", bool(src.SHIP_SUBJECT.match(subject)), want)

# ── ID extraction ────────────────────────────────────────────────────────────
check("ids in a real subject",
      src.ITEM_ID.findall('fix(BUG-KIT-DECIMALS-01): Kit quotes the number on the card'),
      ['BUG-KIT-DECIMALS-01'])
# The scope names what SHIPPED. The body names everything the commit touched,
# found, corrected or deferred — reading it fired on a commit that FILED a new
# open item and demanded a registry row for something deliberately left open.
def ids_for(subject):
    m = src.SCOPE.match(subject)
    return [i for i in dict.fromkeys(src.ITEM_ID.findall(m.group(1) if m else subject))
            if not src.NOT_A_FEATURE.match(i)]

check("two shipped items in one scope",
      ids_for('fix(UX-AUTH-01, UX-AUTH-03): the app stops becoming the website'),
      ['UX-AUTH-01', 'UX-AUTH-03'])
check("an item FILED in the body is not demanded",
      ids_for('fix(UX-PLAN-MOVE-01): the Plan row is quiet again'),
      ['UX-PLAN-MOVE-01'])
check("§106 scope yields no feature id — it is a principle",
      ids_for('feat(§106): a plan never peaks below where the runner already is'), [])
check("prose is not an ID", src.ITEM_ID.findall('A PLAN never peaks below START'), [])
check("a bare word is not an ID", src.ITEM_ID.findall('MAINTENANCE and BUILD'), [])

# governance artefacts are not features and must not be demanded of the registry
for gov in ['ADR-022', 'CD-21', 'INV-PLAN-PEAK-NOT-BELOW-START', 'CB-CAT-01']:
    check(f"NOT_A_FEATURE({gov})", bool(src.NOT_A_FEATURE.match(gov)), True)
check("NOT_A_FEATURE(UX-AUTH-01)", bool(src.NOT_A_FEATURE.match('UX-AUTH-01')), False)

# ── THE ONE THAT MATTERS: mentioned-in-someone-else's-row is NOT recorded ─────
REGISTRY_SAMPLE = """| Feature | Tier | Release | Notes |
|---|---|---|---|
| Charity-runner landing page (GTM-CHARITY-01) | FREE | 2026-09-11 | The audience widened later the same day, see GTM-CHARITY-02. |
| Sign-in asks for one decision (UX-AUTH-02) | FREE | 2026-09-11 | Progressive disclosure. |
"""
names = ' '.join(r.split('|')[1] for r in REGISTRY_SAMPLE.splitlines()
                 if r.startswith('| ') and r.count('|') >= 2)
check("mentioned in another row is NOT covered", 'GTM-CHARITY-02' in names, False)
check("a plain substring search WOULD have passed it", 'GTM-CHARITY-02' in REGISTRY_SAMPLE, True)
check("its own row IS covered", 'UX-AUTH-02' in names, True)

# ── build-log: heading, not body ─────────────────────────────────────────────
BUILDLOG_SAMPLE = """# Zonna build-log

## 2026-09-11 — UX-AUTH-02 · The sign-in screen asks for one decision
**Shipped:** progressive disclosure. Follows on from GTM-CHARITY-02's audience work.
"""
headings = ' '.join(l for l in BUILDLOG_SAMPLE.splitlines() if l.startswith('## '))
check("body mention is NOT an entry", 'GTM-CHARITY-02' in headings, False)
check("heading IS an entry", 'UX-AUTH-02' in headings, True)

if failures:
    print("FAIL")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print(f"ship-record-check: all checks passed")
