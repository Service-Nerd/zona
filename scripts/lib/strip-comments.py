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

import re
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

    🔴 THE BACKTICK IS THE EXCEPTION AND MUST BE (code review round 16). A template literal
    genuinely spans lines, so resetting it made every CONTINUATION line read as code — and a
    `/*` inside one (a path like `lib/plan/*` in a prompt) then opened a block comment that
    blanked every remaining line of the file. Measured: a hardcoded coach name and a hardcoded
    hex both passed every guard. Carrying it is safe in a way `'` and `"` are not: a stray
    backtick outside a template is a syntax error, where an apostrophe is ordinary prose.

    ⚠️ An unterminated `'` or `"` is a syntax error, so it was never a string: the line is
    re-scanned with THAT ONE OPENER ignored, by index. Not by character — disabling `'` for
    the whole line reinterprets earlier, correctly-closed strings, which blanked live code
    (code review round 5). Backticks are left alone: a template literal spans lines.
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
    stack: list[int] = []
    for line in src.split('\n'):
        # 🔴 AN UNTERMINATED `'` OR `"` MEANS IT WAS NEVER A STRING (code review round 4).
        # `<p>Kit's pace</p> {/* #B5C0B4 */}` — the apostrophe opened a quote that never
        # closed, so the `/*` after it was suppressed and the hex stayed live code. A real
        # unterminated single- or double-quoted string is a syntax error, so when one is open
        # at end of line the scan re-runs with that character disabled. Backticks are left
        # alone: a template literal genuinely spans lines.
        skip: set[int] = set()
        # Each pass adds one distinct index from the line's own `'`/`"` set, so that count is a
        # provable bound. Capped anyway, and an exhausted loop keeps the FIRST pass's result
        # rather than the last: a half-converged scan must not carry a block state onward.
        first: tuple[str, bool, list[int], int | None] | None = None
        for _ in range(min(line.count("'") + line.count('"'), 8) + 1):
            text, nxt_block, nxt_stack, open_at = _scan_line(line, in_block, list(stack), skip)
            if first is None:
                first = (text, nxt_block, nxt_stack, open_at)
            if open_at is None or open_at in skip:
                break
            skip.add(open_at)
        else:
            text, nxt_block, nxt_stack, _ = first           # un-converged: conservative
        out.append(text)
        in_block, stack = nxt_block, nxt_stack
    return '\n'.join(out)


def _starts_regex(out: list[str]) -> bool:
    """Is the `/` about to be read the start of a regex literal, rather than division or a
    comment? The standard heuristic: a regex cannot follow a value."""
    prev = ''.join(out).rstrip()
    if not prev:
        return False                       # a line starting with `/` is a comment here
    last = prev[-1]
    # ⚠️ JSX, not a regex: `</p>` and `<Foo />`. Without this the `/` of a closing tag opened
    # a "regex" that ran to the next `/` and swallowed a real comment after it.
    if last == '<':
        return False
    if last.isalnum() or last in '_$)]':
        # `return /x/` and `typeof /x/` are the exceptions: a keyword is not a value.
        return bool(re.search(r'\b(return|typeof|case|in|of|new|delete|void|do|else)$', prev))
    return last not in '`\'"'


def _scan_line(line: str, in_block: bool, stack: list[int],
               skip: set[int]) -> tuple[str, bool, list[int], int | None]:
    """One line -> (blanked text, block state, template stack, index of any quote left open).

    🔴 THE STACK IS FOR NESTED TEMPLATES, and without it carrying template state across lines
    was WORSE than resetting it (code review round 16). A template's `${ ... }` holds CODE,
    which may open another template. Toggling on every backtick read the nested opener as the
    outer closer, so parity flipped, an apostrophe later on the line opened a quote, and the
    file was then "inside a template" for 975 lines of `ruleEngine.ts` — every comment in them
    left as code. Each entry is a brace depth: inside `${`, `}` at depth 0 returns to the
    template. `'` and `"` stay line-scoped, for the reason the module docstring gives.
    """
    out: list[str] = []
    quote: str | None = None
    quote_at: int | None = None
    i, n = 0, len(line)
    while i < n:
        c = line[i]
        nxt = line[i + 1] if i + 1 < n else ''
        if in_block:
            if c == '*' and nxt == '/':
                in_block = False; out.append('  '); i += 2; continue
            out.append(' '); i += 1; continue
        # inside a template's literal text (not inside one of its `${}` holes)
        if stack and stack[-1] < 0:
            if c == '\\':
                out.append(line[i:i + 2]); i += 2; continue
            if c == '`':
                stack.pop(); out.append(c); i += 1; continue
            if c == '$' and nxt == '{':
                stack.append(0); out.append(line[i:i + 2]); i += 2; continue
            out.append(c); i += 1; continue
        if quote:
            if c == '\\':
                out.append(line[i:i + 2]); i += 2; continue
            if c == quote:
                quote = None
            out.append(c); i += 1; continue
        # ⚠️ `/*` and `//` WIN: a regex literal can start with neither, and treating `{/* … */}`
        # as one blanked nothing across 2,348 lines when first written. `/>` is JSX.
        if c == '/' and nxt not in '/*>' and _starts_regex(out):
            # 🔴 A REGEX LITERAL IS SCANNED, because `/^https?:\\/\\//` ENDS IN `//` and was read
            # as a line comment — a SILENT FALSE NEGATIVE, not the loud false positive the
            # docstring claimed. One live instance in 660 files
            # (`lib/health/nativeCredential.ts`), where everything after it was blanked and a
            # planted coach name passed every guard.
            j, cls = i + 1, False
            while j < n:
                d = line[j]
                if d == '\\':
                    j += 2; continue
                if d == '[':
                    cls = True
                elif d == ']':
                    cls = False
                elif d == '/' and not cls:
                    break
                j += 1
            if j < n:
                k = j + 1
                while k < n and line[k].isalnum():
                    k += 1                       # trailing flags
                out.append(line[i:k]); i = k; continue
            # unterminated on this line: not a regex after all, fall through
        if c == '/' and nxt == '/':
            out.append(' ' * (n - i)); i = n; continue
        if c == '/' and nxt == '*':
            in_block = True; out.append('  '); i += 2; continue
        if c == '`' and i not in skip:
            stack.append(-1); out.append(c); i += 1; continue
        if stack and c == '{':
            stack[-1] += 1
        elif stack and c == '}':
            if stack[-1] == 0:
                stack.pop(); out.append(c); i += 1; continue   # back into the template
            stack[-1] -= 1
        if c in '\'"' and i not in skip:
            quote = c; quote_at = i
        out.append(c); i += 1
    return ''.join(out), in_block, stack, (quote_at if quote else None)


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
