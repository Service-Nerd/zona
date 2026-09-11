#!/usr/bin/env python3
"""PostToolUse: a ship that never reached the registry or the build-log.

CLAUDE.md's doc flow is roadmap → backlog → ship → feature-registry + build-log.
The `/ship` skill performs that move, and the move is the step that gets skipped,
because by the time it comes round the interesting part (the code) is finished.

Measured on 2026-09-11: the same manual audit was run THREE times in one day and
found a gap every time — five items across thirteen shipped, each missing a
registry row, a build-log entry, or both. `backlog-touch.py` already flags an
open backlog entry naming a changed file, but nothing verified the two docs on
the other side of the move actually gained anything.

⚠️ WHY THIS DOES NOT JUST GREP FOR THE ID. The third audit missed GTM-CHARITY-02
because its ID *did* appear in the registry — inside another feature's row, in a
sentence referring to it. A bare substring search reported the file as covered.
So this checks STRUCTURE, not presence: the ID must appear in a registry row's
FIRST CELL (the feature name) and in a build-log `##` HEADING. Mentioned in
someone else's paragraph is exactly the state this exists to catch.

Advisory. Plenty of legitimate commits are one step of a multi-commit feature
where the records land at the end; it prompts, it never blocks.

Contract: reads the PostToolUse payload on stdin, always exits 0.
"""
import json
import os
import re
import subprocess
import sys

# A ship, not a step towards one. `refactor:`/`docs:`/`chore:`/`test:` are
# deliberately absent — the SESSION-KM-01 refactor legitimately preceded its
# own feat commit by an hour and carried no registry row of its own.
SHIP_SUBJECT = re.compile(r'^(feat|fix)\(', re.I)

# Zonna item IDs: UX-AUTH-01, BUG-KIT-DECIMALS-01, GTM-CHARITY-02, SEC-08.
# At least one hyphen and a trailing number, so it cannot match a bare word.
ITEM_ID = re.compile(r'\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{2,})\b')

# ⚠️ READ THE SUBJECT'S SCOPE, NEVER THE BODY. The first cut scanned the whole
# message and immediately fired on a commit that FILED a new item
# ("Filed, not fixed: PLAN-LONGRUN-COLOUR-01") — demanding a registry row for
# something deliberately left open. A body names everything a commit touched,
# discovered, corrected or deferred; only `type(scope):` names what SHIPPED, and
# that convention holds across every commit in this repo. Reading the body trades
# a false negative for a false positive, and a hook that cries wolf gets
# disabled, which is the same as having no hook (NOISE-GATE-01).
SCOPE = re.compile(r'^(?:feat|fix)\(([^)]*)\)', re.I)

# IDs that name a governance artefact rather than a shipped feature. A coaching
# principle lives in CoachingPrinciples.md and an ADR in docs/architecture; the
# registry is for things that were BUILT.
NOT_A_FEATURE = re.compile(r'^(ADR|CD|CB|INV|D)-')

REGISTRY = 'docs/canonical/feature-registry.md'
BUILDLOG = 'docs/build-log.md'
# Source, as opposed to a pure documentation commit.
SOURCE = re.compile(r'^(lib|app|components|scripts|supabase)/')


def git(root, *args):
    return subprocess.run(['git', *args], cwd=root, capture_output=True,
                          text=True, timeout=10).stdout


def registry_names(root):
    """First cell of every table row — the feature NAME, not its description."""
    try:
        with open(os.path.join(root, REGISTRY), encoding='utf-8') as fh:
            rows = [l for l in fh if l.startswith('| ')]
    except OSError:
        return None
    return ' '.join(r.split('|')[1] for r in rows if r.count('|') >= 2)


def buildlog_headings(root):
    try:
        with open(os.path.join(root, BUILDLOG), encoding='utf-8') as fh:
            return ' '.join(l for l in fh if l.startswith('## '))
    except OSError:
        return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (payload.get('tool_input') or {}).get('command', '') or ''
    if not re.match(r'^\s*git\s+commit\b', cmd):
        return 0

    root = os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    try:
        subject = git(root, 'log', '-1', '--pretty=%s').strip()
        changed = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split()
    except Exception:
        return 0

    if not subject or not SHIP_SUBJECT.match(subject):
        return 0
    if not any(SOURCE.match(f) for f in changed):
        return 0  # documentation-only: nothing was built

    scope = SCOPE.match(subject)
    ids = [i for i in dict.fromkeys(ITEM_ID.findall(scope.group(1) if scope else subject))
           if not NOT_A_FEATURE.match(i)]
    if not ids:
        return 0

    names, headings = registry_names(root), buildlog_headings(root)
    if names is None or headings is None:
        return 0  # cannot read the docs — say nothing rather than cry wolf

    missing = []
    for item in ids:
        gaps = []
        if item not in names:
            gaps.append('registry row')
        if item not in headings:
            gaps.append('build-log entry')
        if gaps:
            missing.append((item, gaps))
    if not missing:
        return 0

    lines = '\n'.join(f"  {i:<22} missing: {', '.join(g)}" for i, g in missing)
    msg = (
        "SHIPPED, BUT NOT RECORDED — run /ship.\n\n"
        f"  commit: {subject[:90]}\n{lines}\n\n"
        "CLAUDE.md's flow is roadmap → backlog → ship → feature-registry + build-log. "
        "The move is the step that gets skipped, because by the time it comes round the "
        "code is already finished. On 2026-09-11 the same manual audit ran three times in "
        "one day and found a gap every time.\n\n"
        "This checks STRUCTURE, not presence: the ID has to be in a registry row's FIRST "
        "CELL and in a build-log `##` heading. An ID mentioned inside another feature's "
        "paragraph is what a plain grep calls covered — and is exactly the state that "
        "slipped through.\n\n"
        "If this is one step of a multi-commit feature, ignore it and record the item when "
        "the user-visible half lands."
    )
    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
