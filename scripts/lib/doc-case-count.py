#!/usr/bin/env python3
"""Which case count does CLAUDE.md state for ONE suite? Distinct answers, one per line.

🔴 EACH COUNT BELONGS TO ITS NEAREST SUITE NAME (code review rounds 5 and 6). Resolving
this as "the first `N cases` on a line mentioning the name" claimed another suite's count
twice over — once before a fix that stripped only the text BEFORE the name, once after it,
because a foreign count can sit on either side. The doc writes the name then the count
("`X.test.sh` — 23 cases") and occasionally the reverse ("16 cases in `X.test.sh`"), so
distance resolves both and a neighbour's count is never claimed.

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
            # distance to the name, measured to the nearer end of the occurrence
            nearest = min(names, key=lambda n: abs(n[0] + len(n[1]) - m.start())
                          if n[0] < m.start() else abs(n[0] - m.end()))
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
