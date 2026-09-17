#!/usr/bin/env python3
"""PostToolUse: a hand-written "state at end of day" paragraph that a later ship
has silently invalidated.

WHY THIS EXISTS, with the measurement. On 2026-09-17 the founder asked three
times for the documents to be brought up to date, and each time they were — and
each time the answer went stale within the hour:

  2ec6f0a  "state at END of 2026-09-17", 2,047 tests / 221 files  -> 6 more ships followed
  e3c2a14  "state at END of 2026-09-17", 2,066 tests / 226 files  -> 1 more ship followed

Nothing in either commit was wrong when it was written. Both said "end of day"
in the middle of the day, and the work carried on. The founder found both.

⚠️ THE ASYMMETRY IS THE WHOLE POINT. On the same day, every ID -> registry row,
ID -> build-log entry, principle -> amendment and invariant -> registry row was
correct on every single check, because `ship-record-check.py` runs on every
commit. The ONLY things that rotted were the paragraphs where a human is the
only check. This repo's own doctrine: a rule that holds only while someone
remembers is not a rule.

THE MECHANISM. The state block names the commit it describes (e.g. `baed70c`).
A docs commit may not name itself, so docs commits are ignored. But once a
`feat(`/`fix(` commit lands that is NEWER than the SHA the block names, the
block is describing a tree that no longer exists — and says so with numbers.

Advisory, like its siblings: a mid-feature commit is a legitimate reason to
leave the block alone until the last push. It prompts, it never blocks.

Contract: reads the PostToolUse payload on stdin, always exits 0.
"""
import json
import os
import re
import subprocess
import sys

# Docs that carry a dated state paragraph naming the commit it describes.
STATE_DOCS = ["docs/releases/backlog.md", "docs/releases/roadmap.md"]

# A short SHA in backticks inside a state paragraph. Anchored on the phrases
# those blocks actually use, so an unrelated SHA elsewhere in the file is not
# mistaken for the state marker.
STATE_LINE_RE = re.compile(
    r"(?:PICK UP HERE|state at end of|ENGINE STATE)[^\n]*\n(?:[^\n]*\n){0,3}?[^\n]*?`([0-9a-f]{7,40})`",
    re.IGNORECASE,
)


def run(*args):
    try:
        return subprocess.run(
            args, cwd=ROOT, capture_output=True, text=True, timeout=10
        ).stdout.strip()
    except Exception:
        return ""


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    cmd = (payload.get("tool_input") or {}).get("command", "") or ""
    if not cmd.lstrip().startswith("git commit"):
        return

    subject = run("git", "log", "-1", "--format=%s")
    # Only a SHIP invalidates a state block. A docs commit is how the block gets
    # fixed, and it can never name its own SHA.
    if not re.match(r"^(feat|fix)\(", subject):
        return

    head = run("git", "rev-parse", "--short=7", "HEAD")
    stale = []
    for rel in STATE_DOCS:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
        except Exception:
            continue
        m = STATE_LINE_RE.search(src)
        if not m:
            continue
        named = m.group(1)
        if named.startswith(head) or head.startswith(named):
            continue
        # Is the named commit an ANCESTOR of HEAD? If it is not (e.g. it names a
        # newer or unrelated SHA) stay quiet rather than guess.
        if run("git", "cat-file", "-t", named) != "commit":
            continue
        ahead = run("git", "rev-list", "--count", f"{named}..HEAD")
        if ahead and ahead.isdigit() and int(ahead) > 0:
            stale.append((rel, named, ahead))

    if not stale:
        return

    lines = [
        "STATE BLOCK STALE — a dated state paragraph now describes an older tree.",
        "",
    ]
    for rel, named, ahead in stale:
        lines.append(f"  {rel} names `{named}`; HEAD is `{head}` ({ahead} commit(s) later).")
    lines += [
        "",
        "That paragraph asserts test counts and a commit, and this ship just moved both.",
        "It was accurate when written — that is exactly how it goes stale unnoticed.",
        "",
        "Either update it now with real numbers (re-run the counts, never type them",
        "from memory), or say plainly that it is deliberately left until the last",
        "push of the session. Do not report 'documents are up to date' while it stands.",
    ]
    print("\n".join(lines), file=sys.stderr)


ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()

if __name__ == "__main__":
    main()
