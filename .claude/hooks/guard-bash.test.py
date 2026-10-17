#!/usr/bin/env python3
"""Regression tests for guard-bash.py. Run: python3 .claude/hooks/guard-bash.test.py

Cases live in this file (not on a command line) so the guard under test never
sees the fixture strings as an executed command — that meta-collision is what
made an inline shell harness unusable.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("guard", os.path.join(HERE, "guard-bash.py"))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def blocked(command: str) -> bool:
    # The guard's own decision function, so a new rule cannot be skipped by the harness.
    return guard.reason_for(command) is not None


BLOCK = "block"
ALLOW = "allow"

CASES = [
    # (description, command, expected)
    ("git reset --hard",            "git reset --hard HEAD~1",                 BLOCK),
    ("git clean -fd",               "git clean -fd",                           BLOCK),
    ("force push",                  "git push origin main --force",            BLOCK),
    ("force push -f",               "git push -f origin main",                 BLOCK),
    ("force-with-lease (safe)",     "git push origin main --force-with-lease", ALLOW),
    ("stash drop",                  "git stash drop",                          BLOCK),
    ("stash clear",                 "git stash clear",                         BLOCK),
    ("branch -D main",              "git branch -D main",                      BLOCK),
    ("rm -rf /",                    "rm -rf /",                                BLOCK),
    ("rm -rf ~",                    "rm -rf ~",                                BLOCK),
    ("rm -rf repo root",            "rm -rf /Users/russellshear/zona-app",     BLOCK),
    ("rm -rf * ",                   "rm -rf *",                                BLOCK),
    ("sudo rm -rf /",              "sudo rm -rf /",                            BLOCK),
    ("env-prefixed rm -rf /",       "FOO=bar rm -rf /",                        BLOCK),
    ("chained reset",               "npm run build && git reset --hard",       BLOCK),
    # must ALLOW — everyday work
    ("rm -rf node_modules",         "rm -rf node_modules",                     ALLOW),
    ("rm -rf .next chained",        "rm -rf .next && npm run build",           ALLOW),
    ("rm -rf /tmp file",            "rm -rf /tmp/screenshot-1.png",            ALLOW),
    ("normal commit",               "git commit -m 'feat: x'",                 ALLOW),
    ("git stash",                   "git stash",                               ALLOW),
    ("git checkout -b",             "git checkout -b feature",                 ALLOW),
    # false positives: dangerous strings quoted inside a commit message
    ("commit msg mentions reset",
     "git commit -m 'chore: block git reset --hard and rm -rf /'",            ALLOW),
    ("commit msg mentions force",
     "git commit -m 'guard blocks force-push and git clean -f'",              ALLOW),
    ("commit heredoc mentions",
     "git commit -m \"$(printf 'blocks git reset --hard\\nand force-push')\"", ALLOW),
    # real multi-line heredoc commit body whose wrapped lines start with
    # dangerous tokens — the exact shape of this feature's own commit.
    ("heredoc body starts with git clean -f",
     "git commit -m \"$(cat <<'EOF'\n"
     "chore: add guard\n\n"
     "  git clean -f, force-push, stash drop are blocked\n"
     "git reset --hard is blocked too\n"
     "rm -rf / is refused\n"
     "EOF\n)\"",                                                              ALLOW),
    # 🔴 2026-10-17 — unquoted heredoc + backtick: the exact shape that stripped code names from docs
    ("unquoted <<PY writing markdown backticks (the incident)",
     "python3 - <<PY\nedit('d.md', 'x', 'S6 Am.1, `S-LOWER-BALANCE`')\nPY",     BLOCK),
    ("unquoted <<EOF cat with backticks",
     "cat > f.md <<EOF\nuse `not_main` here\nEOF",                       BLOCK),
    ("unquoted <<-EOF with backticks",
     "cat > f.md <<-EOF\n\tsee `x`\n\tEOF",                              BLOCK),
    ("quoted <<'PY' with backticks is literal",
     "python3 - <<'PY'\nedit('d.md', 'x', '`S-LOWER-BALANCE`')\nPY",   ALLOW),
    ("double-quoted <<\"EOF\" with backticks is literal",
     "cat > f.md <<\"EOF\"\n`x`\nEOF",                                    ALLOW),
    ("unquoted heredoc with only $VAR expansion (intended)",
     "cat > lib/p.test.ts <<EOF\nwriteFileSync('$SP/out', x)\nEOF",          ALLOW),
    ("unquoted heredoc with an escaped backtick (literal)",
     "python3 - <<PY\nedit('d.md', 'x', '\\`code\\`')\nPY",              ALLOW),
    ("🔴 '<<PY' as TEXT inside a quoted heredoc is not an opener (the guard's first false positive)",
     "python3 - <<'PY'\ns = 'refuses an unquoted heredoc (`<<PY`) with `x`'\nPY",   ALLOW),
    ("a quoted heredoc then a real unquoted one with backticks",
     "cat > a <<'EOF'\n`fine`\nEOF\ncat > b <<EOF\n`bad`\nEOF",                 BLOCK),
    ("backtick AFTER the heredoc closes is not in the body",
     "cat > f <<EOF\nplain\nEOF\necho done",                                ALLOW),
]


def main() -> int:
    failures = 0
    for desc, cmd, expected in CASES:
        got = BLOCK if blocked(cmd) else ALLOW
        ok = got == expected
        if not ok:
            failures += 1
        mark = "✓" if ok else "✗ MISMATCH"
        print(f"{mark} {got:<5} (want {expected:<5}) | {desc}")
    print(f"\n{len(CASES) - failures}/{len(CASES)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
