#!/usr/bin/env python3
"""PostToolUse: a NEW check that was never shown able to fail.

GATE-FALSIFY-01 (b). "Falsify any new check before trusting it green" is written
in CLAUDE.md, in the build skill's Phase 2 and in zona-debug's exit criteria —
three documents, all true, none executable. Meanwhile docs/build-log.md
accumulated "hollow" x 15, "inert" x 23, "substring" x 11.

This repo has shipped a green tick with nothing behind it repeatedly: a
`--section-gap` that never applied, a `flexShrink` that could never fire, two
inert §97 gates, a `tierResolution` test asserting its own copy of the thing it
guarded, and on 2026-09-24 alone three more — a falsification case with
unreachable code after its assertion, a contracts audit that could not report a
MISSING contract, and a verification query that returned the same answer whether
or not the migration had applied.

⚠️ WHAT THIS CAN AND CANNOT DO. It cannot verify that a mutation was actually
run — nothing at commit time can. It refuses the SILENCE. That is a weaker
guarantee than lib/hollowTestShapes.test.ts (a), which mechanically detects two
shapes, and it is deliberately the second-ranked half of the item.

⚠️ AND AN HONEST NEGATIVE IS A COMPLETE ANSWER, exactly as fix-test-check.py
accepts one. "Could not falsify because the route throws in test env" is the
right message; silence is not.

NOISE, MEASURED BEFORE THIS WAS WRITTEN, because a hook that fires on ordinary
work gets switched off — which this repo records as equivalent to having no hook.
Over 1,050 commits since 2026-09-01: 245 add a new test file, 172 of those (70%)
ALREADY state falsification, and 73 would prompt. That is 7.0% of all commits,
and the 70% matters more than the 73: the practice is largely followed, so this
catches a residual rather than nagging a habit nobody has.

Contract: reads the PostToolUse payload on stdin, always exits 0, never blocks.
"""
import json
import os
import re
import subprocess
import sys

# Same shape as fix-test-check.py's TEST_FILE — one vocabulary for "is a test",
# not a second copy that drifts (DELOAD-OWNER-01 / TIER-OWNER-01 class).
TEST_FILE = re.compile(r'(\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|\.test\.py|/__tests__/)')

# Deliberately GENEROUS. The point is to refuse silence, not to police wording —
# a hook that rejects a real answer because it was phrased differently is worse
# than no hook. Includes the honest negative.
STATED = re.compile(
    r'falsif\w*'                      # falsify / falsified / falsification
    r'|mutat\w*'                       # mutation-verified / mutant
    r'|fails?[-\s]before'              # fails-before / fails before
    r'|(went|goes|turns?|turned)\s+red'
    r'|red\s*(->|→|to)\s*green'
    r'|proven\s+by\s+reverting'
    r'|(could|can)\s*not\s+(be\s+)?(falsif\w*|made\s+to\s+fail)'
    r'|not\s+falsifiable',
    re.I,
)


def git(root, *args):
    return subprocess.run(['git', *args], cwd=root, capture_output=True,
                          text=True, timeout=10).stdout.strip()


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
        body = git(root, 'log', '-1', '--pretty=%B')
        # ADDED only. Modifying an existing test is routine maintenance; the rule
        # is about a check that did not exist before and has never been shown to
        # fail. Firing on every edit to a test file is how this becomes noise.
        added = git(root, 'diff-tree', '--no-commit-id', '--name-only',
                    '--diff-filter=A', '-r', 'HEAD').split()
    except Exception:
        return 0

    # 🔴 THE SUBJECT IS AN IDENTIFIER, NOT A CLAIM — read the BODY only.
    #
    # `ship-record-check.py` reads the subject's scope and never the body; this is
    # the same discipline inverted, and it is here because of a real false
    # negative: the commit scope `GATE-FALSIFY-01` CONTAINS the word "FALSIFY",
    # so every commit on this very item silenced its own hook. Any id, branch name
    # or ticket reference carrying a trigger word would do the same.
    body_only = '\n'.join(body.split('\n')[1:])

    if not body or not added:
        return 0
    new_tests = [f for f in added if TEST_FILE.search(f)]
    if not new_tests:
        return 0
    if STATED.search(body_only):
        return 0  # it says how — nothing to add

    shown = ', '.join(new_tests[:4]) + ('…' if len(new_tests) > 4 else '')
    msg = (
        "NEW CHECK, NO FALSIFICATION STATED — worth one more look.\n\n"
        f"  new test file(s): {shown}\n"
        "  commit message says how it was made to go RED: no\n\n"
        "\"Falsify any new check before trusting it green\" is in CLAUDE.md, the build "
        "skill's Phase 2 and zona-debug's exit criteria. It has been stated three times and "
        "enforced nowhere, while the build-log accumulated 15 hollow checks, 23 inert ones "
        "and 11 substring misses — a --section-gap that never applied, a flexShrink that "
        "could never fire, a test asserting its own copy of the thing it guarded.\n\n"
        "Break what this guards and watch it go red, then say so in the message. If you "
        "cannot — the route throws in test env, it needs a device, it runs on someone "
        "else's machine — say THAT instead. An honest negative is a complete answer; "
        "silence is not.\n\n"
        "(This only refuses the silence. It cannot check that you ran the mutation.)"
    )
    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
