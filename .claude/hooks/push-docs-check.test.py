#!/usr/bin/env python3
"""Tests for push-docs-check.py — both directions, against the REAL hook.

The hook exists because the founder asked, repeatedly, why he was told the
documents were up to date when they were not: `audit-docs.sh` is a GIT-BASED
check, so it can only be right AFTER a commit, and answering from the edits you
just made is answering from memory. `git push` is the last moment before the
work leaves the machine.

⚠️ THE AUDIT IS NOT UNDER TEST HERE AND MUST NOT BE RUN. `scripts/audit-docs.sh`
is 1,097 lines that read the live repo. The hook resolves it from
CLAUDE_PROJECT_DIR, so every case plants a two-line FAKE in a scratch repo. What
is under test is the hook's own logic: which commands it reacts to, which it
ignores, what it passes to the script, and how it reads the result.

⚠️ STREAM: this hook writes its JSON to STDOUT, not stderr.

One arm here checks a CLAIM A COMMENT MAKES. The hook passes `--no-advance` and
its comment says the script "takes an arg to skip advancing its marker". That
was once read as a SINCE date instead of a flag (audit-docs.sh:15-19 records
it), and it happened to behave, which is luck rather than correctness. The fake
records its argv so the flag is asserted rather than believed.
"""
import json
import os
import subprocess
import sys
import tempfile

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "push-docs-check.py")

ARGV_LOG = "argv.log"


def fire(repo, cmd):
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


def repo_with_audit(tmp, exit_code, output="", present=True):
    """A scratch repo carrying a fake scripts/audit-docs.sh."""
    if not present:
        return tmp
    os.makedirs(os.path.join(tmp, "scripts"), exist_ok=True)
    path = os.path.join(tmp, "scripts", "audit-docs.sh")
    with open(path, "w") as fh:
        fh.write("#!/usr/bin/env bash\n")
        fh.write(f'printf "%s\\n" "$@" > "$(dirname "$0")/../{ARGV_LOG}"\n')
        for line in output.split("\n"):
            fh.write(f"echo {json.dumps(line)}\n")
        fh.write(f"exit {exit_code}\n")
    os.chmod(path, 0o755)
    return tmp


FAILS = []


def check(name, cond):
    print(("  PASS  " if cond else "  FAIL  ") + name)
    if not cond:
        FAILS.append(name)


def case(name, cmd, should_fire, exit_code=1, output="── x ──\nmissing: a row", present=True):
    with tempfile.TemporaryDirectory() as tmp:
        out = fire(repo_with_audit(tmp, exit_code, output, present), cmd)
        fired = bool(out)
        check(f"{'FIRES ' if should_fire else 'silent'}  {name}", fired == should_fire)
        return out, tmp


def main():
    print("push-docs-check.py\n")

    print(" ── must FIRE: a real push while the audit is dirty ──")
    case("bare 'git push'", "git push", True)
    case("git push origin main", "git push origin main", True)
    case("git -C path push", "git -C /tmp/x push", True)
    case("push at the end of a chain", "cd /tmp/x && git push", True)
    case("push -u origin branch", "git push -u origin feat/x", True)
    case("--force-with-lease is still a push", "git push --force-with-lease", True)
    case("fires on exit code even when every line is filtered out",
         "git push", True, output="── header ──\nok")

    print("\n ── must stay SILENT ──")
    case("the audit is clean", "git push", False, exit_code=0)
    case("tags only", "git push --tags", False)
    case("a branch delete", "git push origin --delete feat/x", False)
    case("a commit is not a push", "git commit -m 'x'", False)
    case("git status", "git status", False)
    case("no audit script in the repo", "git push", False, present=False)
    case("an unrelated command", "npm run build", False)

    print("\n ── trap: the word 'push' reachable only across a pipe or && ──")
    # `[^&|;]*` between `git` and `push` is deliberate: a pipeline whose LATER
    # stage mentions push is not a push.
    case("git log | grep push", "git log --oneline | grep push", False)
    case("git status; echo push", "git status; echo push", False)
    case("git status && echo push", "git status && echo push", False)

    print("\n ── the comment's claim, asserted rather than believed ──")
    with tempfile.TemporaryDirectory() as tmp:
        repo_with_audit(tmp, 1, "missing: a row")
        fire(tmp, "git push")
        logged = open(os.path.join(tmp, ARGV_LOG)).read().split("\n")
        check("the audit is called with exactly --no-advance",
              [a for a in logged if a] == ["--no-advance"])

    print("\n ── the message carries the real gaps and drops the noise ──")
    out, _ = case("gap text reaches the message", "git push", True,
                  output="── CONTRACTS ──\nok\nmissing: a registry row for X-01\ncode=3")
    check("names the gap", "missing: a registry row for X-01" in out)
    check("drops the ── section header", "── CONTRACTS ──" not in out)
    check("drops a bare 'ok' line", "\nok\n" not in out)
    check("drops the code= line", "code=3" not in out)
    check("says the audit is not clean", "NOT clean" in out)
    check("names the two structural recurrences", "state block cannot name its own SHA" in out)

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
