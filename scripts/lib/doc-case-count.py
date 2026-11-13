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


def _names_on(line: str, bases: list[str]) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for b in bases:
        at = line.find(b)
        while at >= 0:
            out.append((at, b)); at = line.find(b, at + 1)
    return out


def _owner(line: str, m: re.Match, names: list[tuple[int, str]]) -> str | None:
    """Which suite does this `N cases` belong to? One rule, both consumers."""
    before = [n for n in names if n[0] + len(n[1]) <= m.start()]
    if before:
        return max(before, key=lambda n: n[0] + len(n[1]))[1]
    after = [n for n in names if n[0] >= m.end()]
    if not after:
        return None
    # ⚠️ THE FORWARD FALLBACK IS TIGHT, and must be. Unbounded, it binds an aggregate to the
    # next suite named anywhere on the line: "351 cases in all — `design-guard.test.py` with
    # 72" made 351 a second claim for design-guard. The only backward phrasing in use is
    # "16 cases in `X`", so the join must be short and unbroken.
    nearest = min(after, key=lambda n: n[0])
    join = line[m.end():nearest[0]]
    if len(join) > 6 or re.search(r'[,.;:\u2014]', join):
        return None
    return nearest[1]


def counts(doc: str, names: list[str], bases: list[str]) -> list[str]:
    seen: list[str] = []
    for line in doc.split('\n'):
        on = _names_on(line, bases)
        if not on:
            continue
        for m in re.finditer(r'(\d+) cases', line):
            if _owner(line, m, on) in names and m.group(1) not in seen:
                seen.append(m.group(1))
    return seen


def unattributed(doc: str, bases: list[str]) -> list[str]:
    """Every `N cases` that binds to no known suite — the arm's negative space.

    🔴 AN UNATTRIBUTABLE CLAIM WAS READ AS "NO CLAIM" and silently skipped, under a comment
    saying that is fine. It is fine for a suite the doc never counts; it is not fine for one
    it counts in a phrasing this cannot resolve, which was true of three.
    """
    out: list[str] = []
    for line in doc.split('\n'):
        on = _names_on(line, bases)
        for m in re.finditer(r'(\d+) cases', line):
            if _owner(line, m, on) is None:
                out.append('%s cases  ...%s...' % (m.group(1), line[max(0, m.start() - 48):m.end() + 8].strip()))
    return out


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--unattributed':
        with open(sys.argv[2], encoding='utf-8') as fh:
            print('\n'.join(unattributed(fh.read(), sys.argv[3:])))
        sys.exit(0)
    if len(sys.argv) < 3:
        print('doc-case-count.py DOC NAME[,ALIAS...] BASE...', file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], encoding='utf-8') as fh:
        print('\n'.join(counts(fh.read(), sys.argv[2].split(','), sys.argv[3:])))
