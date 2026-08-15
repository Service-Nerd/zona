#!/usr/bin/env python3
"""PreToolUse coaching-doctrine guard for Edit / Write / MultiEdit.

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
"""
import json
import os
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
]

TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}

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

    if payload.get("tool_name") not in TOOLS:
        return 0

    tool_input = payload.get("tool_input") or {}
    hit = matched_doctrine_file(tool_input.get("file_path", "") or "")
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
