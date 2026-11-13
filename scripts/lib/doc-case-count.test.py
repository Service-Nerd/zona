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
unattributed = _mod.unattributed

A, B = 'alpha.test.sh', 'beta.test.sh'
A_SUBJECT = 'alpha.py'          # the hook/script a suite tests, named in the same prose
BASES = [A, B, A_SUBJECT]

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
    ('an aggregate does NOT bind forwards across a dash',
     'Twelve suites, 351 cases in all — `%s` with 72 cases' % A, A, ['72']),
    ('…nor across a comma', '351 cases, and `%s` with 72 cases' % A, A, ['72']),
    ('…but a tight "N cases in `X`" still binds', '16 cases in `%s`' % A, A, ['16']),
    ('two conflicting counts are both reported',
     '`%s` — 38 cases\nlater, `%s` — 19 cases' % (A, A), A, ['38', '19']),
    ('a repeat of the same count is reported once',
     '`%s` — 16 cases; the 16 cases only run when synced' % A, A, ['16']),
    ('a line naming nothing is ignored', 'the suite runs 99 cases', A, []),
    ('a count on another line of its own is still attributed',
     'intro\n`%s` — 7 cases' % A, A, ['7']),
    ('a name with no count yields nothing', '`%s` is wired into verify' % A, A, []),
]


# (name, doc, names, bases, want) — the ALIAS half: a suite counted under its subject's name
ALIAS_CASES = [
    ('a count bound to the subject name reaches the suite through its alias',
     'PostToolUse falsify (`%s`): advisory. Tests: 14 cases.' % A_SUBJECT, [A, A_SUBJECT], ['14']),
    ('…and without the alias it binds to nothing',
     'PostToolUse falsify (`%s`): advisory. Tests: 14 cases.' % A_SUBJECT, [A], []),
    ('a path-prefixed name still binds forwards',
     '16 cases in `scripts/lib/%s`' % A, [A], ['16']),
]

# what binds to NO suite at all
UNATTRIBUTED_CASES = [
    ('an aggregate across suites', 'Twelve suites, 351 cases in all — `%s` with 72 cases' % A, ['351']),
    ('a count owned by a suite is not listed', '`%s` — 23 cases' % A, []),
    ('a count on a line naming no suite is unchecked by definition', 'the runner ran 99 cases', ['99']),
]


def main() -> int:
    failed = 0
    for name, doc, base, want in CASES:
        got = counts(doc, [base], BASES)
        if got != want:
            failed += 1
            print('  ✗ %s\n      want %r, got %r\n      doc: %r' % (name, want, got, doc))
        else:
            print('  ✓ %s' % name)
    for name, doc, names, want in ALIAS_CASES:
        got = counts(doc, names, BASES)
        if got != want:
            failed += 1
            print('  \u2717 %s\n      want %r, got %r' % (name, want, got))
        else:
            print('  \u2713 %s' % name)
    for name, doc, want in UNATTRIBUTED_CASES:
        got = [u.split(' cases')[0] for u in unattributed(doc, BASES)]
        if got != want:
            failed += 1
            print('  \u2717 unattributed: %s\n      want %r, got %r' % (name, want, got))
        else:
            print('  \u2713 unattributed: %s' % name)
    total = len(CASES) + len(ALIAS_CASES) + len(UNATTRIBUTED_CASES)
    print('\n  %d cases, %d failed' % (total, failed))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
