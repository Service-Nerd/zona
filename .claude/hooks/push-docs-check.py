#!/usr/bin/env python3
"""PostToolUse: a `git push` runs the documentation audit. Not optional.

⚠️ WHY THIS EXISTS, IN THE FOUNDER'S WORDS (2026-09-22):

    "why when I ask if the documents are up-to-date are you wrong every time
     and I have to make you do it even though it's part of my build process"

He is right, and the reason is structural rather than forgetfulness.
`audit-docs.sh` is a GIT-BASED check: it compares shipped commits against the
records. So it can only be correct AFTER the commit — and the assistant's habit
was to answer "yes, all documented" from the edits it had just made, which is
answering from memory. Every single time it has been answered that way it has
been wrong.

Two of those misses are structural and will recur forever without a gate:

  1. A STATE BLOCK CANNOT NAME ITS OWN SHA. It is written before the commit it
     must cite, so the last commit of every batch leaves it stale by
     construction. Nothing the author does at write time can fix that.
  2. THE ID IN THE COMMIT SCOPE AND THE ID IN THE RECORDS CAN DIFFER.
     `ship-record-check` matches the scope; a registry row filed under a
     different string is invisible to it and reads as a missing record.

`git push` is the right moment: it is the end of a batch, the state blocks can
now name a real SHA, and it is the last point before the work leaves the machine.

Advisory — it never blocks a push. It prints what is missing.

Contract: reads the PostToolUse payload on stdin, always exits 0.
"""
import json
import os
import re
import subprocess
import sys


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (payload.get('tool_input') or {}).get('command', '') or ''
    # `git push`, including `git push origin main` and `git -C x push`.
    if not re.search(r'\bgit\b[^&|;]*\bpush\b', cmd):
        return 0
    # A push that only moves tags or deletes a branch is not a ship.
    if re.search(r'--tags|--delete', cmd):
        return 0

    root = os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    script = os.path.join(root, 'scripts', 'audit-docs.sh')
    if not os.path.exists(script):
        return 0
    try:
        # `--check` style: the script takes an arg to skip advancing its marker,
        # so running it here cannot move state a later real run depends on.
        r = subprocess.run(['bash', script, '--no-advance'], cwd=root,
                           capture_output=True, text=True, timeout=120)
    except Exception:
        return 0
    if r.returncode == 0:
        return 0

    gaps = [l for l in r.stdout.split('\n')
            if l.strip() and not l.strip().startswith('──') and l.strip() != 'ok'
            and not re.match(r'^\s*(code=|\d+, unchanged)', l)]
    msg = (
        "PUSHED WITH DOCUMENTATION GAPS — ./scripts/audit-docs.sh is NOT clean.\n\n"
        + '\n'.join(gaps[-12:])
        + "\n\nDo not report the documents as up to date until this says ALL CLEAN.\n"
        "⚠️ TWO OF THESE ARE STRUCTURAL AND WILL RECUR EVERY BATCH:\n"
        "  · a state block cannot name its own SHA, so the last commit always\n"
        "    leaves it stale — it needs a follow-up docs commit;\n"
        "  · the id in the commit SCOPE must match the id in the registry row and\n"
        "    the build-log heading, or the records are invisible to the check.\n"
    )
    json.dump({'hookSpecificOutput': {
        'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
