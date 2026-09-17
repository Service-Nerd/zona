#!/usr/bin/env python3
"""Tests for state-block-check.py — both directions, in a throwaway git repo.

The hook exists because a "state at end of day" paragraph went stale three times
in one day (2026-09-17) while every hook-checked record stayed correct. A hook
that cries wolf gets disabled, which this repo has already recorded as equivalent
to having no hook — so the silent cases matter as much as the firing ones.
"""
import json
import os
import subprocess
import sys
import tempfile

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "state-block-check.py")


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True).stdout.strip()


def fire(repo, cmd="git commit -m x"):
    p = subprocess.run(
        ["python3", HOOK],
        input=json.dumps({"tool_input": {"command": cmd}}),
        capture_output=True, text=True, cwd=repo,
        env={**os.environ, "CLAUDE_PROJECT_DIR": repo},
    )
    assert p.returncode == 0, f"hook must always exit 0, got {p.returncode}"
    return p.stderr


def build_repo(tmp, state_sha_placeholder=True):
    os.makedirs(os.path.join(tmp, "docs", "releases"), exist_ok=True)
    git(tmp, "init", "-q")
    git(tmp, "config", "user.email", "t@t.t")
    git(tmp, "config", "user.name", "t")
    backlog = os.path.join(tmp, "docs", "releases", "backlog.md")
    with open(backlog, "w") as fh:
        fh.write("# Backlog\n\n## PICK UP HERE - state at end of 2026-09-17\n\nAll pushed (`PLACEHOLDER`). 2,076 tests.\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-q", "-m", "docs: seed")
    base = git(tmp, "rev-parse", "--short=7", "HEAD")
    if state_sha_placeholder:
        with open(backlog) as fh:
            src = fh.read()
        with open(backlog, "w") as fh:
            fh.write(src.replace("PLACEHOLDER", base))
        git(tmp, "add", "-A")
        git(tmp, "commit", "-q", "-m", "docs: name the state commit")
    return backlog, base


FAILS = []


def check(name, cond):
    print(("  PASS  " if cond else "  FAIL  ") + name)
    if not cond:
        FAILS.append(name)


print("state-block-check.py")

# 1. A ship after the state block was written -> FLAG.
with tempfile.TemporaryDirectory() as tmp:
    build_repo(tmp)
    git(tmp, "commit", "-q", "--allow-empty", "-m", "feat(X-01): a ship")
    check("flags a feat( ship that postdates the state block", "STATE BLOCK STALE" in fire(tmp))

# 2. Same, via fix( .
with tempfile.TemporaryDirectory() as tmp:
    build_repo(tmp)
    git(tmp, "commit", "-q", "--allow-empty", "-m", "fix(X-01): a fix")
    check("flags a fix( ship too", "STATE BLOCK STALE" in fire(tmp))

# 3. A docs commit is how the block gets FIXED, and can never name itself -> silent.
with tempfile.TemporaryDirectory() as tmp:
    build_repo(tmp)
    git(tmp, "commit", "-q", "--allow-empty", "-m", "docs: refresh the state block")
    check("silent on a docs commit (it cannot name its own SHA)", "STATE BLOCK STALE" not in fire(tmp))

# 4. Block names HEAD exactly -> silent.
with tempfile.TemporaryDirectory() as tmp:
    backlog, _ = build_repo(tmp, state_sha_placeholder=False)
    git(tmp, "commit", "-q", "--allow-empty", "-m", "feat(X-01): ship")
    head = git(tmp, "rev-parse", "--short=7", "HEAD")
    with open(backlog) as fh:
        src = fh.read()
    with open(backlog, "w") as fh:
        fh.write(src.replace("PLACEHOLDER", head))
    check("silent when the block names HEAD", "STATE BLOCK STALE" not in fire(tmp))

# 5. Not a git commit at all -> silent.
with tempfile.TemporaryDirectory() as tmp:
    build_repo(tmp)
    git(tmp, "commit", "-q", "--allow-empty", "-m", "feat(X-01): ship")
    check("silent on a non-commit Bash command", "STATE BLOCK STALE" not in fire(tmp, "npm run verify"))

# 6. No state block in the doc at all -> silent, not a crash.
with tempfile.TemporaryDirectory() as tmp:
    backlog, _ = build_repo(tmp)
    with open(backlog, "w") as fh:
        fh.write("# Backlog\n\nNo state paragraph here.\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-q", "-m", "docs: drop the block")
    git(tmp, "commit", "-q", "--allow-empty", "-m", "feat(X-01): ship")
    check("silent when no state block exists", "STATE BLOCK STALE" not in fire(tmp))

# 7. An unrelated SHA-looking string elsewhere must not be read as the marker.
with tempfile.TemporaryDirectory() as tmp:
    backlog, _ = build_repo(tmp, state_sha_placeholder=False)
    with open(backlog, "w") as fh:
        fh.write("# Backlog\n\nSome item mentions `deadbee` in passing.\n")
    git(tmp, "add", "-A")
    git(tmp, "commit", "-q", "-m", "docs: unrelated sha")
    git(tmp, "commit", "-q", "--allow-empty", "-m", "feat(X-01): ship")
    check("ignores a SHA that is not inside a state paragraph", "STATE BLOCK STALE" not in fire(tmp))

print()
if FAILS:
    print(f"{len(FAILS)} FAILED")
    sys.exit(1)
print("all passed")
