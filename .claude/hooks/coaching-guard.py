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
    # Added 2026-10-16 (STRENGTH-ENGINE-01, ADR-024 §10). The strength engine has
    # the same three layers; its constitution, statute book and catalogue are
    # doctrine, ruled by the strength seat.
    "docs/canonical/StrengthPrinciples.md",
    "packages/strength/config.ts",
    "packages/strength/catalogue.ts",
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


# ── Heredoc bodies that are DATA, not commands ──────────────────────────────
# `cat > some/other/file <<'EOF' ... EOF` writes the body TO that file. A
# doctrine path inside that body is a MENTION, not a write.
#
# Without this, writing a test file whose case table lists doctrine paths fires
# the guard. Measured twice on 2026-09-22, within ten minutes of the design
# guard shipping: writing `design-guard.test.py` (which lists
# CoachingPrinciples.md as a must-not-fire case) tripped the coaching guard, and
# writing an unrelated skill file tripped the design guard the same way.
#
# It is the repo's own recorded failure class: BOUND THE REGION, NEVER GREP THE
# FILE. Rules 2 and 4 below searched the entire command string for a doctrine
# path, so any command that merely quoted one and looked like a write matched.
#
# Only strip when the heredoc has a FILE redirect target that is not itself
# doctrine. `python3 - <<'PY' ... PY` has no redirect target: its body IS
# commands, and that is precisely the shape the Bash coverage exists to catch.
_HEREDOC_OPEN_RE = re.compile(r"""<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1""")


def _strip_data_heredocs(cmd, is_protected):
    """Blank out heredoc bodies that are content written to a non-protected file.

    `is_protected(path)` returns truthy when that path is one the guard watches.
    """
    out = cmd
    for m in _HEREDOC_OPEN_RE.finditer(cmd):
        tag = m.group(2)
        targets = _REDIRECT_TARGET_RE.findall(cmd[:m.start()])
        if not targets:
            continue  # no redirect: the body is commands, keep it
        if is_protected(targets[-1].strip("'\"")):
            continue  # writing INTO a watched file: the guard must still see it
        body = re.search(
            r"(?s)" + re.escape(m.group(0)) + r"(.*?)^" + re.escape(tag) + r"\s*$",
            cmd[m.start():],
            re.MULTILINE,
        )
        if body and body.group(1):
            out = out.replace(body.group(1), "\n")
    return out


# ── Resolving the interpreter's actual write TARGET ─────────────────────────
# Rule 4 below used to grep the whole command for a doctrine path. That is the
# repo's own recorded failure class — BOUND THE REGION, NEVER GREP THE FILE —
# and it fired on any script that merely QUOTED a doctrine path while writing
# something else. Measured 2026-09-22: a python heredoc editing a skill file
# tripped the design guard because the replacement text mentioned
# ui-patterns.md.
#
# So resolve what is actually being opened for writing:
#   open('PATH', 'w')            → literal
#   p = 'PATH' ... open(p, 'w')  → one hop through a variable (the common shape)
#   writeFileSync('PATH', ...)   → node literal / one hop
#
# ⚠️ If NOTHING resolves, fall back to the old whole-command behaviour. An
# unresolvable shape is rare and obfuscated; leaving it unguarded would reopen
# the hole the Bash coverage exists to close. Precision where we can parse,
# conservatism where we cannot.
_OPEN_LITERAL_RE = re.compile(r"""(?:open|writeFileSync|writeFile)\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"][wax])?""")
_OPEN_VAR_RE = re.compile(r"""(?:open|writeFileSync|writeFile)\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*['"][wax]""")
_WRITE_TEXT_RE = re.compile(r"""['"]([^'"]+)['"]\s*\)?\s*\.\s*write_text""")


def _interpreter_write_paths(cmd):
    """Paths this interpreter command opens for WRITING. Empty when unresolvable."""
    paths = set()

    for m in _OPEN_LITERAL_RE.finditer(cmd):
        # Only count a literal open() when a write mode follows it.
        tail = cmd[m.end():m.end() + 24]
        if m.group(0).rstrip().endswith(("w", "a", "x")) or re.match(r"""\s*,\s*['"][wax]""", tail):
            paths.add(m.group(1))
        elif "writeFile" in m.group(0):
            paths.add(m.group(1))

    for m in _WRITE_TEXT_RE.finditer(cmd):
        paths.add(m.group(1))

    for m in _OPEN_VAR_RE.finditer(cmd):
        var = re.escape(m.group(1))
        for a in re.finditer(r"""(?:^|[\s;(])""" + var + r"""\s*=\s*['"]([^'"]+)['"]""", cmd, re.MULTILINE):
            paths.add(a.group(1))

    return {normalise(p) for p in paths}


# ── Segment binding for the in-place editors ────────────────────────────────
# `sed -i` and friends take the file as an ARGUMENT, so the write target is in
# the command — but it must be in the SAME segment as the editor. Scanning the
# whole command means an unrelated `sed -i` on one line plus a watched path on
# another line matches, which is the same substring bias fixed in rules 1 and 4.
#
# Observed 2026-09-22 while falsifying this very hook: a shell block that echoed
# a JSON payload containing `sed -i` on one line and read ui-patterns.md on
# another fired the guard. Fourth instance of the class in one day.
_SEGMENT_SPLIT_RE = re.compile(r"[\n;]|&&|\|\||\|")


def _inplace_target(cmd, candidates):
    """Return the watched path an in-place editor writes, or None.

    The editor and the path must appear in the SAME shell segment.
    """
    for seg in _SEGMENT_SPLIT_RE.split(cmd):
        if not _INPLACE_RE.search(seg):
            continue
        for item in candidates:
            if item in seg:
                return item
    return None


# ── The interpreter's OWN script region ─────────────────────────────────────
# When the write target cannot be resolved, the fallback used to search the
# whole command for a watched path. That matches a path mentioned in a totally
# separate shell segment — e.g. a `python3 ... <<PY` block that edits three
# files, followed by a `grep` that READS a watched one.
#
# Observed 2026-09-22, the fourth instance of the class in one session. The
# idiom it fires on (`for path, old, new in edits:` over a list of tuples) is
# the most common multi-file editing shape there is, so the noise would be
# constant — and a guard that fires on ordinary work gets switched off, which
# this repo has twice recorded as equivalent to having no guard.
#
# So bound the fallback to the interpreter's own script: the heredoc body if
# there is one, else the -c/-e string, else the containing segment.
_HEREDOC_BODY_RE = re.compile(
    r"""<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1(.*?)^\2\s*$""",
    re.DOTALL | re.MULTILINE,
)
_DASH_C_RE = re.compile(r"""-(?:c|e)\s+(['"])(.*?)\1""", re.DOTALL)


def _interpreter_script_region(cmd):
    """The text the interpreter actually runs, or the whole command if unclear."""
    bodies = [m.group(3) for m in _HEREDOC_BODY_RE.finditer(cmd) if m.group(3)]
    bodies += [m.group(2) for m in _DASH_C_RE.finditer(cmd)]
    if bodies:
        return "\n".join(bodies)
    for seg in _SEGMENT_SPLIT_RE.split(cmd):
        if _INTERPRETER_RE.search(seg):
            return seg
    return cmd


def _bash_writes_doctrine(command: str):
    """Return the doctrine file this command WRITES, or None.

    Deliberately asymmetric: a missed write leaves the original hole open, but a
    false positive on a read gets the hook disabled. Reads win ties.
    """
    if not command:
        return None
    cmd = normalise(command)
    cmd = _strip_data_heredocs(cmd, matched_doctrine_file)

    # 1. Redirection — only when a doctrine file is the redirect target.
    for target in _REDIRECT_TARGET_RE.findall(cmd):
        hit = matched_doctrine_file(target)
        if hit:
            return hit

    # 2. In-place editors / tee / patch: naming the file is writing it.
    hit = _inplace_target(cmd, DOCTRINE_FILES)
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
        targets = _interpreter_write_paths(cmd)
        if targets:
            for t in targets:
                hit = matched_doctrine_file(t)
                if hit:
                    return hit
        else:
            # Unresolvable shape: fall back to the pre-2026-09-22 behaviour
            # rather than reopening the hole.
            hit = _first_doctrine_mention(_interpreter_script_region(cmd))
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
