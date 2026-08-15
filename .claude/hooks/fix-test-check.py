#!/usr/bin/env python3
"""PostToolUse: a fix commit with no test change is worth a second look.

Zonna's bugs are overwhelmingly SILENT — enrichment fell back to rule copy for
four months, ingest died for weeks behind a missing column, long-run coaching
never fired at all. None of them crashed. A bug with no symptom has exactly one
durable defence: a regression test that fails before the fix and passes after.
Without one, the same class returns and is invisible again.

So this asks one question at commit time: this looks like a fix, did any test
change with it? Advisory — plenty of legitimate fixes (copy, config, docs,
external-console work) carry no test, and the honest answer is sometimes "this
isn't unit-testable, here's what I verified instead". It prompts; it never blocks.

Contract: reads the PostToolUse payload on stdin, always exits 0.
"""
import json
import os
import re
import subprocess
import sys

FIX_SUBJECT = re.compile(r'^(fix|bugfix|hotfix)\b|\bfix(es|ed)?\b:', re.I)
TEST_FILE = re.compile(r'(\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|\.test\.py|/__tests__/)')
# Source that could plausibly carry a regression test.
TESTABLE = re.compile(r'^(lib|app|components|scripts)/.*\.[cm]?[jt]sx?$')
# Changes that legitimately have no unit test.
EXEMPT = re.compile(r'^(docs/|\.claude/|supabase/migrations/|ios/|public/|\.github/)|'
                    r'(package(-lock)?\.json|tsconfig\.json|\.md)$')


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
        subject = git(root, 'log', '-1', '--pretty=%s')
        changed = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split()
    except Exception:
        return 0

    if not subject or not changed or not FIX_SUBJECT.search(subject):
        return 0
    if any(TEST_FILE.search(f) for f in changed):
        return 0  # a test moved with it — nothing to say

    touched = [f for f in changed if TESTABLE.match(f) and not EXEMPT.match(f)]
    if not touched:
        return 0

    shown = ', '.join(touched[:4]) + ('…' if len(touched) > 4 else '')
    msg = (
        "FIX WITHOUT A TEST — worth one more look.\n\n"
        f"  commit: {subject[:90]}\n"
        f"  source changed: {shown}\n"
        "  test files changed: none\n\n"
        "Zonna's bugs are almost never crashes — they are silent (enrichment dead 4 months, "
        "ingest dead for weeks, long-run coaching never firing). A silent bug has no symptom "
        "to notice next time, so a regression test that FAILS BEFORE and PASSES AFTER is the "
        "only thing holding it shut.\n\n"
        "Either add one now, or state plainly why this class isn't unit-testable and what you "
        "verified instead (a pure-function assertion, a manual check, a device test). "
        "See the zona-debug skill, Exit criteria."
    )
    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
