"""PostToolUse: a commit whose source diff is mostly COMMENT, not code.

PROSE-RATIO-01, 2026-11-13. The founder, after three waves: *"Why are you finding
so many issues? I want to know why there's so much quality issues with the code."*
Measured answer: the engine changes held. What kept failing was everything written
AROUND them — gates that could not fail, comments stating the wrong mechanism,
numbers in records that were false by the time anything read them. Four review
rounds in a row found zero code defects and only false statements.

MEASURED BY THIS FILE'S OWN `measure()`, waves 1-3 against the 50 commits before them:
    mine      421 comment / 683 added source lines = 62%
    prior 50  951 comment / 1977 added source lines = 48%

The threshold below is that 48% with headroom — DERIVED, not chosen.

⚠️ AND THE FIRST PAIR OF NUMBERS WAS WRONG, WHICH IS THE POINT. I first measured
54% against 28% with `grep '^+ *//'`, which counts only `//` lines and MISSES every
continuation line of a block comment — and this codebase writes long `/** ... */`
headers. Deriving a threshold with one definition and gating with another is how a
gate comes to measure something other than the thing its number describes; it fired
on the very history it was built to call normal. Both figures now come from the
function the hook actually runs.

⚠️ WHAT IT CANNOT DO. It cannot read a comment and tell you it is wrong; nothing at
commit time can. It refuses VOLUME, on the evidence that volume is where my errors
live. A long comment that is load-bearing is a legitimate answer — say so and move
on. ADVISORY: a hook that blocks ordinary work gets switched off, which this repo
records as equivalent to having no hook.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

RATIO_LIMIT = 0.55          # house practice is 0.48 by `measure()`; headroom so ordinary work is silent
MIN_COMMENT_LINES = 25      # a small diff cannot trip it — 20 commented lines is not a habit
# 🔴 THE EXACT POPULATION THE THRESHOLD WAS DERIVED FROM, AND THE FIRST CUT WAS NOT.
# I measured 28% over `lib/ app/ components/` minus tests, then wired a DIFFERENT glob set
# (it also swept `scripts/`, where measurement harnesses carry long comments by design) and
# the hook fired on the very history it was supposed to call normal — 47%, not 28%. A gate
# whose population differs from the one its number came from is measuring something else.
SRC = ('lib/', 'app/', 'components/', ':!*.test.ts', ':!*.test.tsx')
COMMENT = re.compile(r'^\+\s*(//|/\*|\*/|\*\s|#)')


def added_lines(args: list[str]) -> list[str]:
    try:
        out = subprocess.run(['git', 'diff', *args], capture_output=True, text=True, timeout=20)
    except Exception:
        return []
    return [l for l in out.stdout.splitlines() if l.startswith('+') and not l.startswith('+++')]


def measure(rev: str = 'HEAD~1..HEAD') -> tuple[int, int]:
    """Returns (comment lines added, total source lines added)."""
    lines = added_lines([rev, '--', *SRC])
    return sum(1 for l in lines if COMMENT.match(l)), len(lines)


def verdict(comments: int, total: int) -> str | None:
    if total == 0 or comments < MIN_COMMENT_LINES:
        return None
    ratio = comments / total
    if ratio <= RATIO_LIMIT:
        return None
    return (
        f"⚠️  PROSE RATIO: {comments} of {total} added source lines are COMMENT "
        f"({ratio:.0%}). House practice is 48%.\n\n"
        "Measured across three waves: the engine changes held, and the defects were in what "
        "was written around them — gates that could not fail, comments stating the wrong "
        "mechanism, numbers already false when read. Four review rounds running found no "
        "code defect and only false statements.\n\n"
        "Two questions before this lands:\n"
        "  1. Is every claim in these comments one you RAN, not one you reasoned? If you "
        "cannot point at the command, write \"not measured\" instead of the claim.\n"
        "  2. Which of these comments would a reader miss if it were deleted? Delete the rest.\n\n"
        "(Advisory. A long comment carrying a real reason is a fine answer — this refuses "
        "volume, not length, because volume is where the errors were.)"
    )


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (payload.get('tool_input') or {}).get('command') or ''
    if not re.match(r'^\s*git\s+commit', cmd):
        return 0
    msg = verdict(*measure())
    if msg:
        json.dump({'hookSpecificOutput': {
            'hookEventName': 'PostToolUse', 'additionalContext': msg}}, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
