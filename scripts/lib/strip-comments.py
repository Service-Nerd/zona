#!/usr/bin/env python3
"""Blank JS/TS comments while PRESERVING line numbers — the single implementation.

🔴 WHY A STRING-AWARE SCANNER AND NOT TWO REGEXES (code review, 2026-11-08).

The first version was `re.sub(r'/\*[\s\S]*?\*/')` then `re.sub(r'//[^\n]*')`, which treats
`//` INSIDE A STRING as the start of a comment and blanks the rest of the line. So

    const DOCS = "https://example.com"        // fine, nothing after it
    const X = { url: "https://a.b", bg: "#B5C0B4" }

loses everything after `https:` — including a hardcoded hex — and the colour guards see
nothing. Latent today (0 live lines in `app/` or `components/` match), but **the whole
"376 files, 5 rules, 0 hits" claim rested on it**, which is the difference between a clean
tree and a check that cannot see.

⚠️ AND IT MUST STILL BLANK A COMMENT, because `HOOK-RGBA-COMMENTS-01` is the opposite
failure: a comment RECORDING a measured colour is prose, and a guard that fires on ordinary
work gets switched off — recorded four times in this repo as equivalent to no guard.

So: one pass, tracking `'`, `"`, backtick and escape state. A regex literal is NOT tracked —
`/.../ ` is ambiguous without a parser and a colour inside one is vanishingly unlikely; the
failure direction there is a false POSITIVE on a comment following a regex, which is loud.

Usage:
  strip-comments.py FILE               → the stripped file on stdout (line numbers preserved)
  strip-comments.py --stream FILE...   → `path:lineno:text` for every line of every file
"""
from __future__ import annotations  # this Mac's python3 evaluates signature annotations

import sys

def strip(src: str) -> str:
    """Blank comments, preserving every newline so line numbers survive.

    🔴 BLOCK COMMENTS FILE-WIDE, LINE COMMENTS PER LINE — and the per-line part is the whole
    point. The first cut of this scanner tracked `'`, `"` and backtick state ACROSS THE FILE,
    and it desynchronised: one unbalanced quote (an apostrophe in JSX text, a quote inside a
    regex literal) puts everything after it "inside a string", so comments stop being
    recognised for the rest of the file. Measured on `components/ui/buttonOwnership.test.ts`:
    the scan was already desynced by line ~400 and reported a hex inside a `//` comment at
    line 688 as live code. **A hand-rolled tokenizer fails silently and in the dangerous
    direction.**

    A line comment cannot span lines, so quote state is tracked WITHIN THE LINE ONLY and reset
    at every newline. A desync is then bounded to one line and shows up as a loud false
    positive rather than a silent blind spot for the rest of the file.

    ⚠️ Known and accepted: an odd apostrophe in JSX text (`<p>don't</p> // note`) leaves that
    one line's trailing comment unblanked. The failure direction is a reported hit on a
    comment — visible, one line, fixable — not an unseen colour.
    """
    # 🔴 ONE PASS, IN SCAN ORDER — AND IT WAS TWO, WHICH BLANKED LIVE CODE (code review,
    # 2026-11-13). Block comments were found FILE-WIDE with `find('/*')` before line comments
    # were removed, so a `/*` appearing inside a `//` comment opened a block that ran to the
    # next `*/`. Measured: 405 lines across 11 files blanked, including a 231-line contiguous
    # window in `app/api/generate-plan/route.ts` — a path like `lib/plan/*` written in a
    # comment is all it takes. A "0 hits" claim made through that is a claim about what the
    # reader could see.
    #
    # ⚠️ AND IT IS SCANNED LINE BY LINE, which is what keeps a desync bounded (docstring) and
    # is also why an escape cannot eat a newline: there are none inside a line.
    out: list[str] = []
    in_block = False
    for line in src.split('\n'):
        # 🔴 AN UNTERMINATED `'` OR `"` MEANS IT WAS NEVER A STRING (code review round 4).
        # `<p>Kit's pace</p> {/* #B5C0B4 */}` — the apostrophe opened a quote that never
        # closed, so the `/*` after it was suppressed and the hex stayed live code. A real
        # unterminated single- or double-quoted string is a syntax error, so when one is open
        # at end of line the scan re-runs with that character disabled. Backticks are left
        # alone: a template literal genuinely spans lines.
        disabled: set[str] = set()
        for _ in range(3):
            text, nxt_block, open_quote = _scan_line(line, in_block, disabled)
            if open_quote in ("'", '"') and open_quote not in disabled:
                disabled.add(open_quote); continue
            break
        out.append(text)
        in_block = nxt_block
    return '\n'.join(out)


def _scan_line(line: str, in_block: bool, disabled: set[str]) -> tuple[str, bool, str | None]:
    """One line → (blanked text, block state after it, quote left open at end)."""
    out: list[str] = []
    quote: str | None = None
    i, n = 0, len(line)
    while i < n:
        c = line[i]
        nxt = line[i + 1] if i + 1 < n else ''
        if in_block:
            if c == '*' and nxt == '/':
                in_block = False; out.append('  '); i += 2; continue
            out.append(' '); i += 1; continue
        if quote:
            if c == '\\':
                out.append(line[i:i + 2]); i += 2; continue
            if c == quote:
                quote = None
            out.append(c); i += 1; continue
        if c == '/' and nxt == '/':
            out.append(' ' * (n - i)); i = n; continue
        if c == '/' and nxt == '*':
            in_block = True; out.append('  '); i += 2; continue
        if c in '\'"`' and c not in disabled:
            quote = c
        out.append(c); i += 1
    return ''.join(out), in_block, quote


def main(argv: list[str]) -> int:
    stream = argv[:1] == ['--stream']
    paths = argv[1:] if stream else argv
    if not paths:
        print('strip-comments.py: no files given', file=sys.stderr)
        return 2
    for p in paths:
        try:
            src = open(p, encoding='utf-8', errors='replace').read()
        except OSError as e:
            print(f'strip-comments.py: cannot read {p}: {e}', file=sys.stderr)
            return 2
        s = strip(src)
        if stream:
            for ln, line in enumerate(s.split('\n'), 1):
                sys.stdout.write(f'{p}:{ln}:{line}\n')
        else:
            sys.stdout.write(s)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
