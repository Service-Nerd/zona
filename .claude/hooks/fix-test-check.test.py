#!/usr/bin/env python3
"""Tests for fix-test-check.py — both directions, against the REAL hook.

The hook is the one whose whole subject is "a fix with no test is worth a second
look", and it was the one fix in the repo with no test (HOOK-TEST-FIXTEST-01).

Two things shape this file:

  1. IT RUNS THE REAL HOOK against scratch git repos, never a copy of its
     regexes. `.githooks/pre-commit.test.sh` set that precedent for a reason: a
     test that re-implements the pattern it is checking passes when the pattern
     drifts. The hook reads `git log -1` and `git diff-tree HEAD`, so every case
     builds an actual commit with an actual subject and an actual file list.

  2. THE SILENT CASES MATTER AS MUCH AS THE FIRING ONES. A hook that cries wolf
     gets disabled, which this repo has already recorded as equivalent to having
     no hook (NOISE-GATE-01). Roughly half the cases below assert silence.

⚠️ STREAM: this hook writes its JSON to STDOUT. `state-block-check.py`, whose
test harness this borrows, prints to STDERR. A suite copied across without
changing the stream would assert on a permanently empty string and pass on
every input, including a hook that had been deleted.
"""
import json
import os
import subprocess
import sys
import tempfile

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fix-test-check.py")


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True,
                          text=True).stdout.strip()


def fire(repo, cmd="git commit -m x"):
    """Run the real hook; return the advisory text it emitted, or ''."""
    p = subprocess.run(
        ["python3", HOOK],
        input=json.dumps({"tool_input": {"command": cmd}}),
        capture_output=True, text=True, cwd=repo,
        env={**os.environ, "CLAUDE_PROJECT_DIR": repo},
    )
    assert p.returncode == 0, f"hook must always exit 0, got {p.returncode}"
    if not p.stdout.strip():
        return ""
    return json.loads(p.stdout)["hookSpecificOutput"]["additionalContext"]


def repo_with(tmp, subject, files):
    """A git repo whose HEAD commit has this subject and changed these paths."""
    git(tmp, "init", "-q")
    git(tmp, "config", "user.email", "t@t.t")
    git(tmp, "config", "user.name", "t")
    # A seed commit, so HEAD's diff-tree is a real delta rather than the root.
    with open(os.path.join(tmp, "seed.txt"), "w") as fh:
        fh.write("seed\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-q", "-m", "chore: seed")
    for f in files:
        path = os.path.join(tmp, f)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            fh.write("x\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-q", "-m", subject)
    return tmp


FAILS = []


def check(name, cond):
    print(("  PASS  " if cond else "  FAIL  ") + name)
    if not cond:
        FAILS.append(name)


def case(name, subject, files, should_fire, cmd="git commit -m x"):
    with tempfile.TemporaryDirectory() as tmp:
        out = fire(repo_with(tmp, subject, files), cmd)
        fired = bool(out)
        check(f"{'FIRES ' if should_fire else 'silent'}  {name}", fired == should_fire)
        return out


def main():
    print("fix-test-check.py\n")

    print(" ── must FIRE: a fix touching testable source with no test ──")
    case("fix(SCOPE): with a lib change", "fix(PLAN-01): wrong km", ["lib/plan/x.ts"], True)
    case("bare 'fix:' subject", "fix: wrong km", ["lib/plan/x.ts"], True)
    case("hotfix:", "hotfix: wrong km", ["lib/plan/x.ts"], True)
    case("bugfix(SCOPE):", "bugfix(X): wrong km", ["lib/plan/x.ts"], True)
    case("app/ route", "fix(API-01): 500", ["app/api/plan/route.ts"], True)
    case("components/ tsx", "fix(UI-01): blank", ["components/shared/Card.tsx"], True)
    case("scripts/ .ts", "fix(OPS-01): crash", ["scripts/audit.ts"], True)
    case("scripts/ .mjs counts as testable", "fix(OPS-02): crash", ["scripts/gen.mjs"], True)
    case("'fixes:' mid-subject", "chore: fixes: the thing", ["lib/a.ts"], True)
    case("testable source beside an exempt doc",
         "fix(X-01): y", ["lib/a.ts", "docs/notes.md"], True)

    print("\n ── must stay SILENT ──")
    case("a feat, not a fix", "feat(X-01): add", ["lib/plan/x.ts"], False)
    case("a test moved with it (.test.ts)", "fix(X-01): y",
         ["lib/plan/x.ts", "lib/plan/x.test.ts"], False)
    case("a test moved with it (__tests__/)", "fix(X-01): y",
         ["lib/plan/x.ts", "lib/__tests__/x.ts"], False)
    case("a test moved with it (.test.py)", "fix(X-01): y",
         ["scripts/a.ts", "scripts/a.test.py"], False)
    case("docs only", "fix(X-01): typo", ["docs/releases/backlog.md"], False)
    case("the .claude/ tree is exempt", "fix(X-01): y", [".claude/hooks/a.py"], False)
    case("a migration is exempt", "fix(X-01): y", ["supabase/migrations/20260101_a.sql"], False)
    case("ios/ is exempt", "fix(X-01): y", ["ios/App/App/A.swift"], False)
    case(".github/ is exempt", "fix(X-01): y", [".github/workflows/ci.yml"], False)
    case("package.json is exempt", "fix(X-01): bump", ["package.json"], False)
    case("a css change is not testable source", "fix(X-01): colour", ["app/globals.css"], False)
    case("source outside the testable roots", "fix(X-01): y", ["tools/a.ts"], False)
    case("not a commit at all", "fix(X-01): y", ["lib/a.ts"], False, cmd="git status")
    case("a push is not a commit", "fix(X-01): y", ["lib/a.ts"], False,
         cmd="git push origin main")

    print("\n ── the message names the real file, and the trap cases ──")
    out = case("names the changed source", "fix(X-01): y", ["lib/plan/sessionKm.ts"], True)
    check("message quotes the file it found", "lib/plan/sessionKm.ts" in out)
    check("message states no tests changed", "test files changed: none" in out)

    # `git commit` must be the FIRST token the hook matches, not merely present:
    # a commit message that talks ABOUT committing is not a commit.
    with tempfile.TemporaryDirectory() as tmp:
        r = repo_with(tmp, "fix(X-01): y", ["lib/a.ts"])
        check("silent  'echo git commit' is not a commit",
              fire(r, "echo 'run git commit next'") == "")

    print("\n ── degenerate input ──")
    p = subprocess.run(["python3", HOOK], input="not json",
                       capture_output=True, text=True)
    check("silent  malformed stdin exits 0 and says nothing",
          p.returncode == 0 and not p.stdout.strip())
    p = subprocess.run(["python3", HOOK], input="{}", capture_output=True, text=True)
    check("silent  empty payload exits 0 and says nothing",
          p.returncode == 0 and not p.stdout.strip())

    print()
    if FAILS:
        print(f"{len(FAILS)} FAILED:")
        for f in FAILS:
            print("  - " + f)
        return 1
    print("all green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
