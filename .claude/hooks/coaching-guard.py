#!/usr/bin/env python3
"""PreToolUse coaching-doctrine guard for Edit / Write / MultiEdit / Bash.

Zonna's Configuration Singularity concentrates every coaching decision into a
small set of named files. That makes "is this a coaching decision?" a file-path
match rather than a judgement call — which is exactly what a hook can enforce.

CoachingPrinciples.md states the coupling itself:
    "If you are editing a numeric, you are editing this document.
     If you are editing this document, you are editing a numeric."

Purpose: make the /coaching-board review fire automatically. Skill descriptions
alone have already proven unreliable for this repo (see the standing correction
that frontend-design must be triggered for UI work — that memory exists because
description-based auto-triggering kept being missed). A hook does not forget.

Contract: reads the PreToolUse payload as JSON on stdin.
  - Default (HARD_BLOCK = False): exit 0 and emit hookSpecificOutput JSON so the
    reminder is injected as context. The edit proceeds; the model is told to
    convene the board or state an exemption.
  - HARD_BLOCK = True: write the reason to stderr and exit 2, which Claude Code
    treats as "deny + show stderr to the model".

Flip HARD_BLOCK if advisory injection turns out to be too easy to sail past.

BASH COVERAGE (added 2026-09-13). For its first year this hook matched only the
dedicated file tools, so every doctrine edit made through Bash — `sed -i`, a
`python3 - <<'PY'` heredoc, `cat > file` — passed with no guard, no prompt and no
trace. CLAUDE.md's claim that "convening is automatic" was therefore false for
that entire path, and it is the path a session told to prefer Bash for file edits
uses for everything. Three doctrine commits on 2026-09-13 went through it.

The hard part is not spotting the path, it is NOT firing on the overwhelmingly
common case of READING one. `sed -n '1,40p' CoachingPrinciples.md` and
`grep -n "§84" CoachingPrinciples.md` must stay silent, or the hook becomes noise
and gets switched off — which this repo has already recorded as the same outcome
as having no hook. So a doctrine path in the command is necessary but NOT
sufficient: the command must also carry a write signal, and for redirection the
path must be the redirect TARGET rather than merely an argument.
"""
import json
import os
import re
import sys

# Set True to deny the edit outright instead of injecting an advisory reminder.
HARD_BLOCK = False

# Editing any of these IS a coaching decision, by doctrine. Matched on path
# suffix so absolute and repo-relative paths both hit.
DOCTRINE_FILES = [
    "docs/canonical/CoachingPrinciples.md",
    "docs/canonical/session-catalogue.md",
    "docs/canonical/zone-rules.md",
    "docs/canonical/coaching-rules.md",
    "lib/plan/generationConfig.ts",
    "lib/plan/planSignatures.ts",
    "lib/plan/sessionFormat.ts",
    # Added 2026-08-20 (SC-00). This file IS the catalogue of concrete sessions
    # the engine may prescribe — doctrine by any reading. It was omitted because
    # the Supabase `session_catalogue` table was believed to be the runtime
    # source; it never was, so for four months what a runner could be given was
    # editable with no board review. Same regression class as HealthObserverPlugin
    # missing from the cap-config re-add list: the guard existed, the entry didn't.
    "lib/plan/sessionCatalogueData.ts",
]

TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}

# ── Bash write detection ────────────────────────────────────────────────────
# In-place / stream editors and copiers, where naming the file IS writing it.
_INPLACE_RE = re.compile(
    r"""(?:^|[|;&]|\s)(?:
          sed\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*i        # sed -i / sed -E -i / sed -i.bak
        | perl\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*i       # perl -pi -e
        | tee\b                                      # tee / tee -a
        | dd\b
        | truncate\b
        | patch\b
      )""",
    re.VERBOSE,
)

# Interpreted-language one-liners and heredocs. A path alone proves nothing here
# (reading a file in python is entirely normal), so a write MODE token is also
# required — this is what keeps `python3 -c "print(open(DOC).read())"` silent.
_INTERPRETER_RE = re.compile(r"(?:^|[|;&]|\s)(?:python3?|node|deno|ruby|perl|php)\b")
_WRITE_MODE_RE = re.compile(
    r"""(?:
          open\s*\([^)]*['"][wax]     # open(p, 'w') / open(p, "a")
        | ['"][wax]\+?['"]\s*[,)]     # a bare 'w' / "a+" argument
        | write_text\b
        | writeFileSync\b
        | writeFile\b
        | \.write\s*\(
      )""",
    re.VERBOSE,
)

# Redirection: capture the TARGET only. `grep x DOCTRINE > /tmp/out` reads
# doctrine and writes elsewhere — that must not fire.
_REDIRECT_TARGET_RE = re.compile(r">>?\s*['\"]?([^\s'\";|&)]+)")

# `cp`/`mv` onto a doctrine file: the destination is the last bare argument.
_COPY_RE = re.compile(r"(?:^|[|;&]|\s)(?:cp|mv|install|rsync)\s+(.+)")


def _bash_writes_doctrine(command: str):
    """Return the doctrine file this command WRITES, or None.

    Deliberately asymmetric: a missed write leaves the original hole open, but a
    false positive on a read gets the hook disabled. Reads win ties.
    """
    if not command:
        return None
    cmd = normalise(command)

    # 1. Redirection — only when a doctrine file is the redirect target.
    for target in _REDIRECT_TARGET_RE.findall(cmd):
        hit = matched_doctrine_file(target)
        if hit:
            return hit

    # 2. In-place editors / tee / patch: naming the file is writing it.
    if _INPLACE_RE.search(cmd):
        hit = _first_doctrine_mention(cmd)
        if hit:
            return hit

    # 3. cp / mv / rsync onto a doctrine path (destination = last argument).
    for args in _COPY_RE.findall(cmd):
        parts = [a for a in args.split() if not a.startswith("-")]
        if parts:
            hit = matched_doctrine_file(parts[-1].strip("'\""))
            if hit:
                return hit

    # 4. An interpreter that both mentions a doctrine path AND opens something
    #    for writing. This is the `python3 - <<'PY' ... open(p, 'w') ... PY`
    #    shape that produced the three unguarded commits.
    if _INTERPRETER_RE.search(cmd) and _WRITE_MODE_RE.search(cmd):
        hit = _first_doctrine_mention(cmd)
        if hit:
            return hit

    return None


def _first_doctrine_mention(cmd: str):
    for doc in DOCTRINE_FILES:
        if doc in cmd:
            return doc
    return None

REMINDER = """⚖️  COACHING DOCTRINE FILE — Coaching Board review required.

You are editing: {path}

This file encodes what the engine prescribes to a runner. Per ADR-017, changes
to coaching doctrine go through the Coaching Board (Hutchinson chairing, with
Seiler, McMillan, Willy, Sims) BEFORE the edit lands.

Do one of these, explicitly, before continuing:

  1. Invoke the `coaching-board` skill and run the review. A CORRECT ruling must
     produce all three artifacts in one commit — principle (§), numeric
     (GENERATION_CONFIG), and invariant (validatePlan()).

  2. State the exemption in one line and proceed. Valid exemptions: a defect fix
     restoring already-documented intent; formatting or typo correction; a
     refactor with no behavioural delta; or writing up artifacts for a board
     review that has ALREADY ruled in this session.

Do not silently proceed without doing one of the two."""


def normalise(path: str) -> str:
    return path.replace(os.sep, "/")


def matched_doctrine_file(path: str):
    if not path:
        return None
    p = normalise(path)
    for doc in DOCTRINE_FILES:
        if p.endswith(doc):
            return doc
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0  # never block on a parse failure

    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input") or {}

    if tool_name == "Bash":
        hit = _bash_writes_doctrine(tool_input.get("command", "") or "")
    elif tool_name in TOOLS:
        hit = matched_doctrine_file(tool_input.get("file_path", "") or "")
    else:
        return 0

    if not hit:
        return 0

    message = REMINDER.format(path=hit)

    if HARD_BLOCK:
        sys.stderr.write(message + "\n")
        return 2

    json.dump({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "additionalContext": message,
        }
    }, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
