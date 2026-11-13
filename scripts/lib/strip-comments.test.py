#!/usr/bin/env python3
"""Cases for `strip-comments.py` — the shared reader every colour and coach-name guard
looks through.

🔴 IT HAD NO TEST, AND THAT IS HOW IT CARRIED A 231-LINE BLIND SPOT (code review round 4,
2026-11-13). Restoring the broken two-pass version left `sweep:colours` (378 files, 0 hits),
`pre-commit.test.sh` (38/38), `sweep-colours.test.sh` (23/23) and `coachNameSwept` (2/2) ALL
GREEN — four suites, none of which could see it, because each asserts what the tree contains
and the tree contains nothing. A reader must be tested on input that distinguishes readers.

Run:  python3 scripts/lib/strip-comments.test.py
      STRIP_COMMENTS_PATH=/tmp/old.py python3 ... — to falsify against another version
"""
from __future__ import annotations

import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.environ.get('STRIP_COMMENTS_PATH', os.path.join(HERE, 'strip-comments.py'))
_spec = importlib.util.spec_from_file_location('strip_comments', TARGET)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
strip = _mod.strip

HEX = '#B5C0B4'

# (name, source, must_survive, must_be_blanked)
CASES = [
    # ── the defect this suite exists for ────────────────────────────────────────────────
    ('a `/*` inside a line comment opens no block',
     '// see lib/plan/*\nconst bg = %r' % HEX, [HEX], ['see lib/plan']),
    ('…and the window does not run to the next `*/`',
     '// lib/plan/*\nconst a = %r\n/* real */\nconst b = 1' % HEX, [HEX, 'const b = 1'], ['real']),
    ('an unterminated apostrophe does not suppress a following block comment',
     "<p>Kit's pace</p> /* %s */" % HEX, ["Kit's pace"], [HEX]),
    ('an unterminated apostrophe does not suppress a following line comment',
     "<p>don't</p> // %s" % HEX, ["don't"], [HEX]),
    ('an escape at end of line does not consume the newline',
     "const s = 'a\\\\'\n// %s" % HEX, ['const s'], [HEX]),

    ('a closed string before an unterminated apostrophe is not reinterpreted',
     "<a href='https://x.io' style={{ color: '%s' }}>Kit's page</a>" % HEX,
     [HEX, 'https://x.io', "Kit's page"], []),
    ('an unterminated apostrophe opens no block from an earlier string',
     "const g = '/*'; const t = <p>Kit's pace</p>\nconst b = %r\nconst c = %r" % (HEX, HEX),
     [HEX, 'const b', 'const c'], []),

    ('a `/*` inside a MULTI-LINE template opens no block comment',
     '''const P = `\n  see lib/plan/* for rules\n  mention Kit\n`\nconst bg = %r''' % HEX,
     ['lib/plan/*', 'mention Kit', HEX], []),
    # The real shape from `lib/plan/ruleEngine.ts:9018` — a nested template inside `${}`,
    # apostrophes in the prose, and an empty string. Without `${}` on the stack the parity
    # flips, an apostrophe opens a quote, and the file is "inside a template" from there on:
    # 975 lines of that file had every comment left as code.
    ('a nested template does not flip the parity and strand the rest of the file',
     '''const n = cond\n  ? `plan's time ${a} weeks.${b != null ? ` You've capped ${c}, and` : ''}`\n  : null\n// %s''' % HEX,
     [], [HEX]),
    ('a `//` inside a regex literal is not a comment, and code after it survives',
     'const RX = /^https?:\\/\\//; const n = "Kit"   // real comment',
     ['https', 'Kit'], ['real comment']),

    # ── what it must still do: blank comments ───────────────────────────────────────────
    ('a line comment is blanked', '// %s' % HEX, [], [HEX]),
    ('a block comment is blanked', '/* %s */' % HEX, [], [HEX]),
    ('a block comment spans lines', '/* a\n%s\n*/ const x = 1' % HEX, ['const x = 1'], [HEX]),
    ('code after a block comment ends on the same line survives',
     '/* x */ const bg = %r' % HEX, [HEX], ['/* x */']),

    # ── what it must NOT do: blank live code ────────────────────────────────────────────
    ('a `//` inside a double-quoted string is not a comment',
     'const u = "https://a.b" /* %s */' % HEX, ['https://a.b'], [HEX]),
    ('a `//` inside a single-quoted string is not a comment',
     "const u = 'https://a.b'\nconst bg = %r" % HEX, ['https://a.b', HEX], []),
    ('a hex inside a string is live code, not prose',
     'const bg = "%s" // note' % HEX, [HEX], ['note']),
    ('code before a trailing comment survives',
     'const bg = %r // measured' % HEX, [HEX], ['measured']),
    ('a `/*` inside a string opens no block',
     'const g = "/*"\nconst bg = %r' % HEX, [HEX], []),
]


def main() -> int:
    failed = 0
    for name, src, survive, blanked in CASES:
        out = strip(src)
        problems = []
        if out.count('\n') != src.count('\n'):
            problems.append('line count %d != %d' % (out.count('\n'), src.count('\n')))
        problems += ['%r was blanked' % t for t in survive if t not in out]
        problems += ['%r survived' % t for t in blanked if t in out]
        if problems:
            failed += 1
            print('  ✗ %s' % name)
            for p in problems:
                print('      %s' % p)
            print('      got: %r' % out)
        else:
            print('  ✓ %s' % name)
    print('\n  %d cases, %d failed' % (len(CASES), failed))
    print('  reader under test: %s' % TARGET)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
