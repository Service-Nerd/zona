#!/usr/bin/env python3
"""PostToolUse: a commit that MOVED code is asked what it moved away from.

🔴 WHY. The founder set the standard on 2026-09-11: *"every change is regression-tested
for upstream AND downstream impact BEFORE the commit, not after"*, and the memory of it
records *"he should not have had to ask."* On 2026-09-28 he had to ask again, about
ME-DOORS-01 — and the four-word question found FIVE silent defects that were already
committed, under 3,872 green tests, a green production build and a clean docs audit.

⚠️ NONE OF THE FIVE WERE IN CODE THE COMMIT EDITED. That is the whole class:

    A RELOCATION MAKES CORRECT CODE WRONG WITHOUT TOUCHING IT.

The worst was a control shipped the previous day whose handler did
`getElementById(ANCHOR)?.scrollIntoView(...)`. Its target moved behind a conditional
render, so `getElementById` returned null, the optional chain swallowed it, and the
chevron did nothing — no error, no log, forever. Its own markup test asserts the chevron
RENDERS; nothing asserted it GOES anywhere.

⚠️ THE RULE EXISTED IN TWO PLACES AND HELD IN NEITHER. `/build` Phase 1 steps 4 and 5 ask
for upstream/downstream in writing, and a feedback memory states the standard. Both were
followed and both missed it, because both are framed as DATA FLOW — *"where is this output
consumed"*, *"what breaks if the shape changes"*. A move has no output and changes no
shape, so the honest answer to both is "none" and the questions were simply wrong ones.
This repo's own doctrine: a rule that holds only while someone remembers is not a rule.

WHAT IT DETECTS. Not "a move" in the abstract — the measurable signature of one: a source
file with a LOT of lines deleted AND a lot added in the same commit (code left one region
and arrived in another), or a large deletion paired with a brand-new sibling file. Both are
what a relocation looks like in `git diff --numstat`.

⚠️ NOISE IS THE DESIGN PROBLEM, as it is for every hook here. A rewrite, a big feature and a
formatting sweep all show churn, so the thresholds are deliberately high and the hook is
SILENT unless the churn is genuinely move-shaped. It prompts; it never blocks. A hook that
fires on ordinary work gets switched off, which this repo records as equivalent to having
no hook at all (NOISE-GATE-01).

Contract: reads the PostToolUse payload on stdin, always exits 0.
"""
import json
import os
import re
import subprocess
import sys

# Only surfaces a runner can reach. An engine refactor has its own harnesses
# (verify / parity / cohort:shape) and does not need this prompt.
REACHABLE = re.compile(r'^(app|components)/.*\.[cm]?[jt]sx?$')
TEST_FILE = re.compile(r'(\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|/__tests__/)')

# A file that both LOST and GAINED this much is not an edit, it is a rearrangement.
MOVE_MIN_DEL = 40
MOVE_MIN_ADD = 40
# Or: a big deletion here, and a new reachable file appearing beside it.
EXTRACT_MIN_DEL = 40


def git(root, *args):
    return subprocess.run(['git', *args], cwd=root, capture_output=True,
                          text=True, timeout=10).stdout.strip()


def numstat(root):
    """[(added, deleted, path)] for HEAD, skipping binary files."""
    out = []
    for line in git(root, 'diff-tree', '--no-commit-id', '--numstat', '-r', 'HEAD').split('\n'):
        parts = line.split('\t')
        if len(parts) != 3 or parts[0] == '-':
            continue
        try:
            out.append((int(parts[0]), int(parts[1]), parts[2]))
        except ValueError:
            continue
    return out


def added_files(root):
    out = []
    for line in git(root, 'diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD').split('\n'):
        parts = line.split('\t')
        if len(parts) >= 2 and parts[0].startswith('A'):
            out.append(parts[1])
    return out


def classify(stats, new_files):
    """Returns (kind, path) for the first move-shaped file, else (None, None)."""
    new_reachable = [f for f in new_files if REACHABLE.match(f) and not TEST_FILE.search(f)]
    for add, dele, path in stats:
        if not REACHABLE.match(path) or TEST_FILE.search(path):
            continue
        if path in new_files:
            continue  # a brand-new file has not moved anything
        if dele >= MOVE_MIN_DEL and add >= MOVE_MIN_ADD:
            return 'rearranged', path
        if dele >= EXTRACT_MIN_DEL and new_reachable:
            return 'extracted', path
    return None, None


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
        subject = git(root, 'log', '-1', '--pretty=%s')
        stats = numstat(root)
        new_files = added_files(root)
    except Exception:
        return 0
    if not subject or not stats:
        return 0
    # A docs-only commit moves prose, not behaviour.
    if subject.lower().startswith('docs'):
        return 0

    kind, path = classify(stats, new_files)
    if not kind:
        return 0

    msg = (
        "CODE MOVED HOUSE — what did it move AWAY from?\n\n"
        f"  commit: {subject[:90]}\n"
        f"  {path} was {kind}\n\n"
        "🔴 A RELOCATION MAKES CORRECT CODE WRONG WITHOUT TOUCHING IT. Every check you have "
        "written asks \"is the code I WROTE correct?\" — when something moves, the defects are "
        "in code you did NOT write, and the suite stays green over all of them.\n\n"
        "Measured on ME-DOORS-01 (2026-09-28): five silent defects, already committed, under "
        "3,872 passing tests, a green production build and a clean docs audit. The founder "
        "found them by asking four words.\n\n"
        "Answer these six now — \"none\" is a claim, so check it (/build § 5b):\n"
        "  1. What navigates INTO it by anchor or id? getElementById on a subtree that is no "
        "longer rendered returns NULL and throws nothing — the quietest failure in the browser.\n"
        "  2. What is reached ONLY from it? Its back now lands somewhere else.\n"
        "  3. What is reached from BOTH it and its old parent? One hardcoded back is wrong for "
        "one of them.\n"
        "  4. What COPY names its old location (\"below\", \"in Profile\") — app AND website? "
        "Note it; do not rewrite founder copy to fit your layout.\n"
        "  5. Does it carry its own header, now duplicated by its new parent's?\n"
        "  6. What ran on MOUNT? Behind a gate it mounts later, or never.\n\n"
        "Then add the check. The suite cannot be it: every arm was written against the code in "
        "its OLD home and passes in the new one."
    )
    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
