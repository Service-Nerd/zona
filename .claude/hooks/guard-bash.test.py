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
    for seg in guard.segments(command):
        for rx, _ in guard.COMPILED:
            if rx.search(seg):
                return True
    return False


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
