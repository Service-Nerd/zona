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
    # Block comments first: unambiguous enough, and this is the behaviour the guards have had
    # since HOOK-RGBA-COMMENTS-01. Newlines are preserved so line numbers do not move.
    out = []
    i, n = 0, len(src)
    while i < n:
        j = src.find('/*', i)
        if j == -1:
            out.append(src[i:]); break
        out.append(src[i:j])
        end = src.find('*/', j + 2)
        end = n if end == -1 else end + 2
        out.append(''.join('\n' if ch == '\n' else ' ' for ch in src[j:end]))
        i = end
    src = ''.join(out)

    lines = []
    for line in src.split('\n'):
        quote = None
        k, m = 0, len(line)
        cut = None
        while k < m:
            c = line[k]
            if quote:
                if c == '\\':
                    k += 2; continue
                if c == quote:
                    quote = None
                k += 1; continue
            if c in '\'"`':
                quote = c; k += 1; continue
            if c == '/' and k + 1 < m and line[k + 1] == '/':
                cut = k; break
            k += 1
        lines.append(line if cut is None else line[:cut] + ' ' * (m - cut))
    return '\n'.join(lines)


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
