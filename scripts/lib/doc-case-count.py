#!/usr/bin/env python3
"""Which case count does CLAUDE.md state for ONE suite? Distinct answers, one per line.

🔴 A COUNT BINDS TO THE NEAREST SUITE NAME BEFORE IT (code review rounds 5-8). Three
earlier rules each claimed a neighbour's number: the first took the first count on any line
naming the suite; the second stripped only the text BEFORE the name, which leaves a foreign
count after it; the third took the nearest name in either direction, which gets
"`A` with 72 cases, `B` with 60 cases" wrong — 72 is closer to B's name than to A's.

The doc writes the name then the count, so the name BEFORE a count owns it. A count with no
name before it on that line ("16 cases in `X.test.sh`") binds forwards instead, which is the
only other phrasing in use.

Usage: doc-case-count.py DOC BASE OTHER_BASE...
"""
from __future__ import annotations

import re
import sys


def counts(doc: str, base: str, bases: list[str]) -> list[str]:
    out: list[str] = []
    for line in doc.split('\n'):
        # every occurrence of every suite name on this line, as (index, base)
        names: list[tuple[int, str]] = []
        for b in bases:
            at = line.find(b)
            while at >= 0:
                names.append((at, b)); at = line.find(b, at + 1)
        if not names:
            continue
        for m in re.finditer(r'(\d+) cases', line):
            before = [n for n in names if n[0] + len(n[1]) <= m.start()]
            after = [n for n in names if n[0] >= m.end()]
            if before:
                nearest = max(before, key=lambda n: n[0] + len(n[1]))
            elif after:
                nearest = min(after, key=lambda n: n[0])
            else:
                continue
            if nearest[1] == base:
                out.append(m.group(1))
    seen: list[str] = []
    for c in out:
        if c not in seen:
            seen.append(c)
    return seen


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('doc-case-count.py: DOC BASE OTHER_BASE...', file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], encoding='utf-8') as fh:
        print('\n'.join(counts(fh.read(), sys.argv[2], sys.argv[3:])))
