#!/usr/bin/env python3
"""PreToolUse safety guard for Bash commands.

Blocks a small, curated set of *unrecoverable* operations before they run.
Deliberately surgical: everyday recursive deletes (node_modules, .next, /tmp)
are allowed; only catastrophic or history-destroying commands are denied.

Matching is anchored to the START of each command segment (splitting on
&&, ||, ;, |, and newlines, after stripping leading sudo/env-assignments).
This is what prevents false positives such as a dangerous string appearing
inside a `git commit -m '...'` message — that segment starts with `git
commit`, so a `^git reset --hard` rule can't match it.

Contract: reads the PreToolUse hook payload as JSON on stdin. To block, we
print a reason to stderr and exit 2 (Claude Code treats exit 2 on PreToolUse
as "deny + show stderr to the model"). Exit 0 allows the call through.
"""
import json
import re
import sys

# Each rule anchors at the start of a command segment (^).
RULES = [
    (r'^git\s+reset\s+--hard\b',
     "git reset --hard discards working-tree + index changes irreversibly. "
     "Stash or commit first, or run it yourself if you truly mean to."),

    (r'^git\s+clean\s+-[a-z]*f',
     "git clean -f permanently deletes untracked files (no reflog, no undo). "
     "Run `git clean -n` to preview, then do it manually if intended."),

    # Force push (but allow the safe --force-with-lease variant).
    (r'^git\s+push\b(?=.*(?:--force\b|\s-f\b))(?!.*--force-with-lease)',
     "Force-pushing can overwrite remote history on main. There is a held-back "
     "App Store commit — this is exactly the scenario to avoid. Use "
     "--force-with-lease, or push manually if you're certain."),

    (r'^git\s+stash\s+(?:drop|clear)\b',
     "git stash drop/clear permanently deletes stashed work. Inspect with "
     "`git stash list` / `git stash show -p` first."),

    (r'^git\s+branch\s+-D\s+(?:main|master)\b',
     "Refusing to force-delete the main branch."),

    # Catastrophic rm targets only — root, home, repo root, or an unqualified
    # wildcard/current-dir wipe. Subpath deletes (node_modules, .next) pass.
    (r'^rm\s+(?:-[a-zA-Z]*\s+)*(?:-[a-zA-Z]*[rf][a-zA-Z]*)\s+'
     r'(?:/\s*$|/\s|~/?\s*$|~\s|\$HOME|\*\s*$|\.\s*$|\./\s*$'
     r'|/Users/russellshear/zona-app/?\s*$)',
     "Refusing rm -rf against a root / home / repo-root / bare-wildcard target. "
     "Delete a specific subpath instead."),
]

COMPILED = [(re.compile(pat), reason) for pat, reason in RULES]

# Command separators that start a fresh command position.
SEP = re.compile(r'(?:&&|\|\||[;|]|\n)')
# Leading noise to strip from each segment before anchoring: whitespace,
# subshell/group parens, `sudo`, and `VAR=value ` env-assignments.
LEAD = re.compile(r'^(?:\s|\(|\{|sudo\s+|[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+')
# Heredoc body matcher. We keep the `<<TAG` opener but drop the body + closing
# tag, so a heredoc'd commit message (whose lines may start with "git clean -f"
# etc.) is never mistaken for a sequence of commands.
HEREDOC = re.compile(r"(?P<open><<-?\s*['\"]?(?P<tag>\w+)['\"]?).*?\n[ \t]*(?P=tag)\b",
                     re.DOTALL)


def strip_heredocs(command: str) -> str:
    return HEREDOC.sub(lambda m: m.group("open"), command)


def segments(command: str):
    for raw in SEP.split(strip_heredocs(command)):
        yield LEAD.sub('', raw)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0  # never block on a parse failure
    if payload.get("tool_name") != "Bash":
        return 0
    command = (payload.get("tool_input") or {}).get("command", "") or ""
    for seg in segments(command):
        for rx, reason in COMPILED:
            if rx.search(seg):
                sys.stderr.write(f"BLOCKED by safety guard: {reason}\n")
                return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
