#!/usr/bin/env python3
"""Regression tests for design-guard.py.
Run: python3 .claude/hooks/design-guard.test.py

Guards two failure directions:
  - a doctrine file or a new surface slipping through unflagged (the board never
    convenes), and
  - a false positive on ordinary work (the hook becomes noise and gets switched
    off, which this repo has twice recorded as the same outcome as not having
    it).

The READ cases matter more than the write cases. `sed -n '1,40p' ui-patterns.md`
and `grep -n ZoneBar ui-patterns.md` are dozens-of-times-a-session operations on
a 2,750-line file. A guard that fires on those is dead within the hour.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("dguard", os.path.join(HERE, "design-guard.py"))
dguard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dguard)

DOCTRINE = "doctrine"
SURFACE = "surface"
PASS = "pass"

REPO = "/Users/russe/rts-training-hub/"

PATTERNS = "docs/canonical/ui-patterns.md"
CSS = "app/globals.css"

CASES = [
    # (description, tool, file_path, expected)
    # ── Category 1: doctrine ────────────────────────────────────────────────
    ("ui-patterns, relative",    "Edit",      PATTERNS,                              DOCTRINE),
    ("ui-patterns, absolute",    "Edit",      REPO + PATTERNS,                       DOCTRINE),
    ("ux-principles",            "Edit",      "docs/canonical/ux-principles.md",     DOCTRINE),
    ("screen-architecture",      "Edit",      "docs/canonical/screen-architecture.md", DOCTRINE),
    ("the ruling register",      "Edit",      "docs/canonical/design-rulings.md",    DOCTRINE),
    # The --surface-moss-wash regression: a token added in globals.css that was
    # forbidden by a rule in ui-patterns.md. The two files had never met. This
    # case is the only thing that notices globals.css dropping off the list.
    ("globals.css tokens",       "Edit",      CSS,                                   DOCTRINE),
    ("globals.css, absolute",    "Write",     REPO + CSS,                            DOCTRINE),
    ("MultiEdit counts",         "MultiEdit", PATTERNS,                              DOCTRINE),
    ("doctrine beats surface",   "Write",     PATTERNS,                              DOCTRINE),

    # ── Category 2: a new user-facing surface ───────────────────────────────
    ("a new shared component",   "Write",     "components/shared/ProofCard.tsx",     SURFACE),
    ("a new marketing section",  "Write",     "components/marketing/Hero.tsx",       SURFACE),
    ("a new page",               "Write",     "app/plans/page.tsx",                  SURFACE),
    ("a new layout",             "Write",     "app/layout.tsx",                      SURFACE),
    ("absolute component path",  "Write",     REPO + "components/shared/Sheet.tsx",  SURFACE),

    # ── Must NOT fire ───────────────────────────────────────────────────────
    # An Edit to an existing component is the SOFT trigger — a judgement call the
    # skill makes, not the hook. A hook that fired here would hit every bug fix
    # and be disabled inside a day.
    ("Edit to a component",      "Edit",      "components/SessionScreen.tsx",        PASS),
    ("Edit to a page",           "Edit",      "app/plans/page.tsx",                  PASS),
    # Tests, fixtures and stories are not surfaces. Firing when someone writes
    # the markup test a ruling just required teaches people to ignore the hook.
    ("a markup test",            "Write",     "components/shared/proofCard.markup.test.ts", PASS),
    ("a .test.tsx",              "Write",     "components/shared/Sheet.test.tsx",    PASS),
    ("a fixture",                "Write",     "components/__fixtures__/plan.tsx",    PASS),
    # Non-visual files.
    ("a lib module",             "Write",     "lib/plan/ruleEngine.ts",              PASS),
    ("an api route",             "Write",     "app/api/generate-plan/route.ts",      PASS),
    ("brand.ts",                 "Edit",      "lib/brand.ts",                        PASS),
    ("brand.md (voice, not us)", "Edit",      "docs/canonical/brand.md",             PASS),
    ("the backlog",              "Edit",      "docs/releases/backlog.md",            PASS),
    ("coaching doctrine",        "Edit",      "docs/canonical/CoachingPrinciples.md", PASS),
    ("this hook itself",         "Edit",      ".claude/hooks/design-guard.py",       PASS),
    ("a css module, not global", "Edit",      "app/marketing.module.css",            PASS),
    # Non-edit tools never fire.
    ("Read is exempt",           "Read",      PATTERNS,                              PASS),
    ("Grep is exempt",           "Grep",      PATTERNS,                              PASS),
    # Bash is routed by `command`, never `file_path`.
    ("Bash ignores file_path",   "Bash",      PATTERNS,                              PASS),
]


def fires(tool: str, file_path: str) -> str:
    if tool not in dguard.TOOLS:
        return PASS
    if dguard.matched_doctrine_file(file_path) is not None:
        return DOCTRINE
    if tool in dguard.NEW_SURFACE_TOOLS and dguard.matched_new_surface(file_path) is not None:
        return SURFACE
    return PASS


# ── Bash cases ──────────────────────────────────────────────────────────────
# The write shapes are the ones actually used to edit these files in this repo.
# The read shapes are the ones used dozens of times a day on the same files.
BASH_CASES = [
    # (description, command, expected)
    ("sed -i on patterns",   "sed -i '' 's/foo/bar/' " + PATTERNS,                   DOCTRINE),
    ("sed -E -i on css",     "sed -E -i 's/a/b/' " + CSS,                            DOCTRINE),
    ("redirect overwrite",   "cat template > " + PATTERNS,                           DOCTRINE),
    ("redirect append",      "echo '## Pattern 41' >> " + PATTERNS,                  DOCTRINE),
    ("heredoc to doctrine",  "cat > " + PATTERNS + " <<'EOF'\nx\nEOF",             DOCTRINE),
    ("heredoc to css",       "cat > " + CSS + " <<'EOF'\n:root{}\nEOF",            DOCTRINE),
    ("tee",                  "echo x | tee " + PATTERNS,                             DOCTRINE),
    ("cp onto doctrine",     "cp /tmp/new.md " + PATTERNS,                           DOCTRINE),
    ("mv onto doctrine",     "mv /tmp/new.css " + CSS,                               DOCTRINE),
    ("python heredoc write",
     "python3 - <<'PY'\np='" + PATTERNS + "'\ns=open(p,encoding='utf-8').read()\nopen(p,'w',encoding='utf-8').write(s)\nPY", DOCTRINE),
    ("node writeFileSync",   "node -e \"require('fs').writeFileSync('" + CSS + "', s)\"", DOCTRINE),
    # A new surface created through Bash — the same hole, one category down.
    ("heredoc a component",  "cat > components/shared/ProofCard.tsx <<'EOF'\nx\nEOF", SURFACE),
    ("cp onto a component",  "cp /tmp/Hero.tsx components/marketing/Hero.tsx",        SURFACE),

    # ── READS — every one of these must stay silent ─────────────────────────
    ("sed -n range read",    "sed -n '1,40p' " + PATTERNS,                           PASS),
    ("grep read",            'grep -n "ZoneBar" ' + PATTERNS,                        PASS),
    ("grep -c read",         "grep -c moss " + CSS,                                  PASS),
    ("cat read",             "cat " + PATTERNS,                                      PASS),
    ("head/tail read",       "head -20 " + PATTERNS + " | tail -5",                  PASS),
    ("wc read",              "wc -l " + PATTERNS,                                    PASS),
    ("git show read",        "git show HEAD:" + PATTERNS,                            PASS),
    ("git log read",         "git log --oneline -- " + CSS,                          PASS),
    # The dangerous near-miss: reads doctrine, writes somewhere else entirely.
    ("read doctrine, write elsewhere",
     "grep -n moss " + CSS + " > /tmp/out.txt",                                      PASS),
    ("python READ of doctrine",
     "python3 -c \"print(open('" + PATTERNS + "').read()[:200])\"",                PASS),
    ("cp FROM doctrine",     "cp " + PATTERNS + " /tmp/backup.md",                    PASS),
    # Unrelated writes must never fire.
    ("write a lib file",     "sed -i '' 's/a/b/' lib/plan/ruleEngine.ts",             PASS),
    ("redirect to a lib",    "echo x > lib/plan/invariants.ts",                       PASS),
    ("write a markup test",  "cat > components/shared/x.markup.test.ts <<'EOF'\nx\nEOF", PASS),
    ("no path at all",       "npm run verify",                                        PASS),
    ("empty command",        "",                                                      PASS),

    # ── 2026-09-22 regressions: the guard fired on its OWN test file ────────
    # Within ten minutes of shipping, this hook and the coaching hook both fired
    # on commands that merely QUOTED a watched path while writing something
    # else. It is the repo's recorded substring-bias class: BOUND THE REGION,
    # NEVER GREP THE FILE. A guard that cries wolf gets switched off, which this
    # repo has twice recorded as equivalent to having no guard.
    ("heredoc writing a TEST that lists doctrine paths",
     "cat > .claude/hooks/design-guard.test.py <<'E'\nCASES=[('x','Edit','" + PATTERNS + "',PASS)]\nopen(p,'w').write(s)\nE", PASS),
    ("python heredoc editing a SKILL file that mentions doctrine",
     "python3 - <<'PY'\np='.claude/skills/slt-review/SKILL.md'\ns=open(p).read()\ns=s.replace('a','`" + PATTERNS + "`')\nopen(p,'w').write(s)\nPY", PASS),
    ("python writing a doc that quotes a token file",
     "python3 - <<'PY'\npath='docs/architecture/ADR-023-design-board-authority.md'\nopen(path,'w').write('see " + CSS + "')\nPY", PASS),
    # The true positives that must survive the fix.
    ("python heredoc genuinely writing doctrine, via a variable",
     "python3 - <<'PY'\np='" + PATTERNS + "'\nopen(p,'w').write(s)\nPY", DOCTRINE),
    ("literal open() write to doctrine",
     "python3 -c \"open('" + PATTERNS + "','w').write(x)\"", DOCTRINE),
    # Unresolvable write target falls back to the conservative behaviour rather
    # than reopening the hole.
    ("unresolvable target falls back to firing",
     "python3 - <<'PY'\nf=open(compute(),'w')\nf.write('" + PATTERNS + "')\nPY", DOCTRINE),

    # ── Segment binding: `sed -i` must be in the SAME segment as the path ───
    # Found while falsifying this hook: a shell block echoing a JSON payload
    # containing "sed -i" on one line, and reading ui-patterns.md on another,
    # fired the guard. Fourth instance of the substring-bias class in one day.
    ("sed -i on one line, a doctrine READ on another",
     "echo 'sed -i x'\necho hello\nsed -n '1,5p' " + PATTERNS, PASS),
    ("unrelated sed -i, then a doctrine grep",
     "sed -i '' 's/a/b/' lib/plan/ruleEngine.ts\ngrep -n foo " + PATTERNS, PASS),
    ("doctrine INSIDE the sed segment of a chain",
     "npm run build && sed -i '' 's/a/b/' " + PATTERNS + " && echo done", DOCTRINE),

    # ── The interpreter fallback is bound to its OWN script region ──────────
    # Fourth instance of the substring-bias class in one session. The idiom is
    # the most common multi-file edit shape there is — a python heredoc looping
    # over (path, old, new) tuples — followed by a grep that READS a watched
    # file. Constant noise, and noise gets the guard switched off.
    ("python edits other files, then a later grep READS the register",
     "python3 - <<'PY'\nfor path, old, new in edits:\n    open(path,'w').write(s)\nPY\ngrep -rn Traynor docs/canonical/design-rulings.md", PASS),
    ("unresolvable target INSIDE the script still fires",
     "python3 - <<'PY'\nf=open(compute(),'w')\nf.write('" + PATTERNS + "')\nPY", DOCTRINE),
]


def bash_fires(command: str) -> str:
    found = dguard._bash_write_target(command)
    return found[0] if found else PASS


def main() -> int:
    failures = 0
    for desc, tool, path, expected in CASES:
        actual = fires(tool, path)
        ok = actual == expected
        if not ok:
            failures += 1
        print(f"{'✓' if ok else '✗'} {desc:<26} {tool:<10} → {actual} (expected {expected})")

    # Malformed input must never fire and never raise.
    extra = 0
    for desc, path in [("empty path", ""), ("none-ish path", None)]:
        ok = (dguard.matched_doctrine_file(path or "") is None
              and dguard.matched_new_surface(path or "") is None)
        if not ok:
            failures += 1
        extra += 1
        print(f"{'✓' if ok else '✗'} {desc:<26} {'—':<10} → pass")

    print()
    for desc, command, expected in BASH_CASES:
        actual = bash_fires(command)
        ok = actual == expected
        if not ok:
            failures += 1
        print(f"{'✓' if ok else '✗'} {desc:<32} Bash       → {actual} (expected {expected})")

    total = len(CASES) + len(BASH_CASES) + extra
    print()
    print(f"{total} cases, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
