#!/usr/bin/env python3
"""Regression tests for coaching-guard.py.
Run: python3 .claude/hooks/coaching-guard.test.py

Guards two failure directions:
  - a doctrine file slipping through unflagged (the board never convenes), and
  - a false positive on ordinary engine/UI work (the hook becomes noise and
    gets switched off, which is the same outcome as not having it).
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("cguard", os.path.join(HERE, "coaching-guard.py"))
cguard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cguard)

FLAG = "flag"
PASS = "pass"

REPO = "/Users/russellshear/zona-app/"

CASES = [
    # (description, tool, file_path, expected)
    ("constitution, relative",   "Edit",  "docs/canonical/CoachingPrinciples.md",        FLAG),
    ("constitution, absolute",   "Edit",  REPO + "docs/canonical/CoachingPrinciples.md", FLAG),
    ("generation config",        "Edit",  "lib/plan/generationConfig.ts",                FLAG),
    ("plan signatures",          "Write", "lib/plan/planSignatures.ts",                  FLAG),
    ("session format",           "Edit",  "lib/plan/sessionFormat.ts",                   FLAG),
    ("session catalogue",        "Edit",  "docs/canonical/session-catalogue.md",         FLAG),
    ("zone rules",               "Edit",  "docs/canonical/zone-rules.md",                FLAG),
    ("coaching rules",           "Edit",  "docs/canonical/coaching-rules.md",            FLAG),
    ("MultiEdit counts",         "MultiEdit", "lib/plan/generationConfig.ts",            FLAG),

    # Soft-trigger and unrelated files must NOT fire — these are judgement calls
    # the skill makes, not the hook. A hook that fires on ruleEngine.ts would hit
    # every bug fix and get disabled.
    ("rule engine (soft)",       "Edit",  "lib/plan/ruleEngine.ts",                      PASS),
    ("invariants (soft)",        "Edit",  "lib/plan/invariants.ts",                      PASS),
    ("coaching lib (soft)",      "Edit",  "lib/coaching/planAdjustment.ts",              PASS),
    ("format lib",               "Edit",  "lib/format.ts",                               PASS),
    ("brand",                    "Edit",  "lib/brand.ts",                                PASS),
    ("a component",              "Edit",  "components/SessionScreen.tsx",                PASS),
    ("the backlog",              "Edit",  "docs/releases/backlog.md",                    PASS),
    ("plan-invariants doc",      "Edit",  "docs/canonical/plan-invariants.md",           PASS),
    ("this hook itself",         "Edit",  ".claude/hooks/coaching-guard.py",             PASS),

    # Non-edit tools never fire.
    ("Read is exempt",           "Read",  "docs/canonical/CoachingPrinciples.md",        PASS),
    ("Bash is exempt",           "Bash",  "docs/canonical/CoachingPrinciples.md",        PASS),
]


def fires(tool: str, file_path: str) -> bool:
    if tool not in cguard.TOOLS:
        return False
    return cguard.matched_doctrine_file(file_path) is not None


def main() -> int:
    failures = 0
    for desc, tool, path, expected in CASES:
        actual = FLAG if fires(tool, path) else PASS
        ok = actual == expected
        if not ok:
            failures += 1
        print(f"{'✓' if ok else '✗'} {desc:<24} {tool:<10} → {actual} (expected {expected})")

    # Guard the no-path and malformed-input cases.
    for desc, path in [("empty path", ""), ("none-ish path", None)]:
        ok = cguard.matched_doctrine_file(path or "") is None
        if not ok:
            failures += 1
        print(f"{'✓' if ok else '✗'} {desc:<24} {'—':<10} → pass")

    print()
    print(f"{len(CASES) + 2} cases, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
