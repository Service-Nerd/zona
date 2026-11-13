#!/usr/bin/env python3
"""Cases for `doc-case-count.py` — which suite a documented case count belongs to.

🔴 THE TWO PREVIOUS RESOLUTIONS BOTH CLAIMED A NEIGHBOUR'S COUNT, and each was green until
somebody edited an unrelated sentence. A rule about proximity has to be tested on text where
proximity is the only thing distinguishing the answers.
"""
from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('dcc', os.path.join(HERE, 'doc-case-count.py'))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
counts = _mod.counts

A, B = 'alpha.test.sh', 'beta.test.sh'
BASES = [A, B]

CASES = [
    ('name then count', '`%s` — 23 cases, both directions' % A, A, ['23']),
    ('count then name', '16 cases in `%s` only run on a synced machine' % A, A, ['16']),
    ('a neighbour is not claimed', '`%s` — 23 cases. And `%s` read the exit code only.' % (B, A), A, []),
    ('…and the neighbour keeps its own', '`%s` — 23 cases. And `%s` read the exit code only.' % (B, A), B, ['23']),
    ('a count after the second name goes to the second',
     '`%s` is modelled on `%s` — 38 cases' % (B, A), A, ['38']),
    ('…and not to the first', '`%s` is modelled on `%s` — 38 cases' % (B, A), B, []),
    ('two names each with their own count, the doc\'s commonest shape',
     '`%s` with 72 cases, `%s` with 60 cases' % (A, B), A, ['72']),
    ('…and the second keeps its own',
     '`%s` with 72 cases, `%s` with 60 cases' % (A, B), B, ['60']),
    ('an aggregate before any name binds forwards, not to nothing',
     'Twelve suites, 351 cases — `%s` with 72 cases' % A, A, ['351', '72']),
    ('two conflicting counts are both reported',
     '`%s` — 38 cases\nlater, `%s` — 19 cases' % (A, A), A, ['38', '19']),
    ('a repeat of the same count is reported once',
     '`%s` — 16 cases; the 16 cases only run when synced' % A, A, ['16']),
    ('a line naming nothing is ignored', 'the suite runs 99 cases', A, []),
    ('a count on another line of its own is still attributed',
     'intro\n`%s` — 7 cases' % A, A, ['7']),
    ('a name with no count yields nothing', '`%s` is wired into verify' % A, A, []),
]


def main() -> int:
    failed = 0
    for name, doc, base, want in CASES:
        got = counts(doc, base, BASES)
        if got != want:
            failed += 1
            print('  ✗ %s\n      want %r, got %r\n      doc: %r' % (name, want, got, doc))
        else:
            print('  ✓ %s' % name)
    print('\n  %d cases, %d failed' % (len(CASES), failed))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
