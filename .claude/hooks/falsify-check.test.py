#!/usr/bin/env python3
"""Tests for falsify-check.py — both directions, in a throwaway git repo.

⚠️ THE SILENT CASES MATTER AS MUCH AS THE FIRING ONES. A hook that cries wolf
gets disabled, which this repo has recorded as equivalent to having no hook — so
most of these cases assert that it says NOTHING.

Noise was measured on real history before the hook was written: over 1,050
commits since 2026-09-01, 245 add a new test file, 172 (70%) already state
falsification, 73 would prompt. 7.0% of all commits.
"""
import json
import os
import subprocess
import sys
import tempfile

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "falsify-check.py")


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True).stdout.strip()


def fire(repo, cmd="git commit -m x"):
    """Returns the hook's additionalContext, or '' when it stays silent."""
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


def new_repo(tmp):
    git(tmp, "init", "-q")
    git(tmp, "config", "user.email", "t@t.t")
    git(tmp, "config", "user.name", "t")
    os.makedirs(os.path.join(tmp, "lib"), exist_ok=True)
    with open(os.path.join(tmp, "lib", "seed.ts"), "w") as fh:
        fh.write("export const a = 1\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-qm", "chore: seed")


def commit(tmp, files, message):
    for path, content in files.items():
        full = os.path.join(tmp, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as fh:
            fh.write(content)
    git(tmp, "add", "-A")
    git(tmp, "commit", "-qm", message)


CASES = []


def case(name):
    def deco(fn):
        CASES.append((name, fn))
        return fn
    return deco


# ── FIRES ────────────────────────────────────────────────────────────────────

@case("fires: new test file, message says nothing about falsification")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/thing.test.ts": "it('works', () => {})\n"}, "feat(X): add a check")
    out = fire(tmp)
    assert out, "expected the hook to fire"
    assert "lib/thing.test.ts" in out, "must name the file"
    assert "NO FALSIFICATION STATED" in out


@case("fires: several new tests, names them")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/a.test.ts": "x\n", "lib/b.test.ts": "y\n"}, "feat(X): two checks")
    out = fire(tmp)
    assert "lib/a.test.ts" in out and "lib/b.test.ts" in out


@case("fires: a new hook test in .claude/ counts too — it is a gate as much as a vitest file")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {".claude/hooks/x.test.py": "assert True\n"}, "feat(X): guard")
    assert fire(tmp), "a .test.py is still a new check"


@case("fires: a scope containing the word FALSIFY does not count as a statement")
def _(tmp):
    # 🔴 A REAL FALSE NEGATIVE, found while falsifying this hook by hand. The item
    # id `GATE-FALSIFY-01` contains "FALSIFY", so every commit on this very item
    # silenced its own hook. The subject is an identifier, not a claim: the
    # statement is read from the BODY only.
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "x\n"}, "feat(GATE-FALSIFY-01): add a hook and its tests")
    out = fire(tmp)
    assert out, "a trigger word inside the SCOPE must not silence the hook"


@case("fires: an issue ref with a trigger word in the subject still prompts")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "x\n"}, "feat(MUTATION-ENGINE-04): new check")
    assert fire(tmp), "subject words are identifiers, not claims"


# ── STAYS SILENT ─────────────────────────────────────────────────────────────

@case("silent: message states it was falsified")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/thing.test.ts": "x\n"},
           "feat(X): add a check\n\nFalsified by breaking the producer; it goes red.")
    assert fire(tmp) == ""


@case("silent: 'mutation-verified' counts")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/thing.test.ts": "x\n"}, "feat(X): check\n\nMutation-verified: returns red.")
    assert fire(tmp) == ""


@case("silent: 'fails-before and passes after' counts")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "x\n"}, "fix(X): thing\n\nfails-before proven by reverting one file.")
    assert fire(tmp) == ""


@case("silent: THE HONEST NEGATIVE is a complete answer")
def _(tmp):
    # This is the case that keeps the hook usable. fix-test-check.py accepts the
    # same shape, and refusing it would make the hook punish honesty.
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "x\n"},
           "feat(X): check\n\nCould not falsify: the route throws in test env, so every case "
           "goes red for the same reason.")
    assert fire(tmp) == ""


@case("silent: MODIFYING an existing test is routine, not a new check")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "first\n"}, "feat(X): check\n\nfalsified")
    commit(tmp, {"lib/t.test.ts": "second\n"}, "chore: tidy the assertion")
    assert fire(tmp) == "", "a modification must not fire — that is how this becomes noise"


@case("silent: a commit with no new test file at all")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/thing.ts": "export const b = 2\n"}, "feat(X): a feature")
    assert fire(tmp) == ""


@case("silent: not a git commit invocation")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/t.test.ts": "x\n"}, "feat(X): check")
    assert fire(tmp, cmd="git status") == ""


@case("silent: deleting a test file is not adding one")
def _(tmp):
    new_repo(tmp)
    commit(tmp, {"lib/gone.test.ts": "x\n"}, "feat(X): check\n\nfalsified")
    os.remove(os.path.join(tmp, "lib", "gone.test.ts"))
    git(tmp, "add", "-A")
    git(tmp, "commit", "-qm", "chore: drop a dead test")
    assert fire(tmp) == ""


@case("always exits 0 even on a broken payload")
def _(tmp):
    p = subprocess.run(["python3", HOOK], input="not json",
                       capture_output=True, text=True, cwd=tmp,
                       env={**os.environ, "CLAUDE_PROJECT_DIR": tmp})
    assert p.returncode == 0


def main():
    failed = 0
    for name, fn in CASES:
        with tempfile.TemporaryDirectory() as tmp:
            try:
                fn(tmp)
                print(f"  ok    {name}")
            except AssertionError as e:
                failed += 1
                print(f"  FAIL  {name}\n        {e}")
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
