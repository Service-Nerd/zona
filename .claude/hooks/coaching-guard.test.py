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
    ("session catalogue doc",    "Edit",  "docs/canonical/session-catalogue.md",         FLAG),
    # SC-00 regression: the catalogue DATA file is the runtime source of truth
    # for what the engine may prescribe, and was absent from DOCTRINE_FILES for
    # four months. A missing entry is silent — this case is the only thing that
    # would notice it going missing again.
    ("session catalogue data",   "Edit",  "lib/plan/sessionCatalogueData.ts",            FLAG),
    ("catalogue data, absolute", "Write", REPO + "lib/plan/sessionCatalogueData.ts",     FLAG),
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
    # Bash is NO LONGER exempt (2026-09-13) — but it is routed by `command`, not
    # `file_path`, so a Bash payload carrying only a path still does nothing.
    # The real Bash coverage is BASH_CASES below.
    ("Bash ignores file_path",   "Bash",  "docs/canonical/CoachingPrinciples.md",        PASS),
]


def fires(tool: str, file_path: str) -> bool:
    if tool not in cguard.TOOLS:
        return False
    return cguard.matched_doctrine_file(file_path) is not None



# ── Bash cases (added 2026-09-13) ───────────────────────────────────────────
# The hole: for a year this hook matched only the file tools, so any doctrine
# edit made through Bash passed unguarded. The WRITE cases below are the actual
# command shapes used to edit CoachingPrinciples.md on 2026-09-13; the READ
# cases are the shapes used dozens of times the same day to inspect it, and they
# matter more — a guard that fires on `sed -n` gets switched off within an hour,
# which this repo has already recorded as equivalent to having no guard.
DOC = "docs/canonical/CoachingPrinciples.md"
CFG = "lib/plan/generationConfig.ts"

BASH_CASES = [
    # (description, command, expected)
    ("python heredoc write",
     "python3 - <<'PY'\np='" + DOC + "'\ns=open(p,encoding='utf-8').read()\nopen(p,'w',encoding='utf-8').write(s)\nPY", FLAG),
    ("python -c write",
     "python3 -c \"open('" + CFG + "','w').write(x)\"", FLAG),
    ("sed -i",              "sed -i '' 's/foo/bar/' " + DOC,                    FLAG),
    ("sed -E -i",           "sed -E -i 's/a/b/' " + CFG,                        FLAG),
    ("redirect overwrite",  "cat template > " + DOC,                            FLAG),
    ("redirect append",     "echo '## 108' >> " + DOC,                          FLAG),
    ("heredoc to file",     "cat > " + DOC + " <<'EOF'\nx\nEOF",              FLAG),
    ("tee",                 "echo x | tee " + DOC,                              FLAG),
    ("cp onto doctrine",    "cp /tmp/new.md " + DOC,                            FLAG),
    ("mv onto doctrine",    "mv /tmp/new.ts " + CFG,                            FLAG),
    ("node writeFileSync",  "node -e \"require('fs').writeFileSync('" + CFG + "', s)\"", FLAG),

    # READS — every one of these must stay silent.
    ("sed -n range read",   "sed -n '1,40p' " + DOC,                            PASS),
    ("grep read",           'grep -n "§84" ' + DOC,                             PASS),
    ("grep -c read",        "grep -c foo " + CFG,                               PASS),
    ("cat read",            "cat " + DOC,                                       PASS),
    ("head/tail read",      "head -20 " + DOC + " | tail -5",                   PASS),
    ("wc read",             "wc -l " + DOC,                                     PASS),
    ("git show read",       "git show HEAD:" + DOC,                             PASS),
    ("git log read",        "git log --oneline -- " + DOC,                      PASS),
    # The dangerous near-miss: reads doctrine, writes somewhere else entirely.
    ("read doctrine, write elsewhere",
     "grep -n foo " + DOC + " > /tmp/out.txt",                                  PASS),
    ("python READ of doctrine",
     "python3 -c \"print(open('" + DOC + "').read()[:200])\"",                PASS),
    ("cp FROM doctrine",    "cp " + DOC + " /tmp/backup.md",                     PASS),
    # Unrelated files must never fire, written or read.
    ("write a non-doctrine file",  "sed -i '' 's/a/b/' lib/plan/ruleEngine.ts",  PASS),
    ("redirect to non-doctrine",   "echo x > lib/plan/invariants.ts",            PASS),
    ("no path at all",             "npm run verify",                             PASS),
    ("empty command",              "",                                           PASS),
]


def bash_fires(command: str) -> bool:
    return cguard._bash_writes_doctrine(command) is not None


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
    for desc, command, expected in BASH_CASES:
        actual = FLAG if bash_fires(command) else PASS
        ok = actual == expected
        if not ok:
            failures += 1
        print(f"{'✓' if ok else '✗'} {desc:<30} Bash       → {actual} (expected {expected})")

    print()
    print(f"{len(CASES) + len(BASH_CASES) + 2} cases, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
