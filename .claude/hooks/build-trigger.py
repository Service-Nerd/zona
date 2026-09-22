#!/usr/bin/env python3
"""UserPromptSubmit: load the standard build procedure when a build is asked for.

WHY THIS SLOT. Every other hook in this repo fires at one of two moments — the
instant a file is edited (`coaching-guard`, `design-guard`, `guard-bash`) or the
instant a commit lands (`backlog-touch`, `fix-test-check`, `ship-record-check`,
`state-block-check`). Both are REACTIVE. By the time the design guard fires, the
decision to edit doctrine has already been taken; by the time ship-record-check
fires, the code is written.

`UserPromptSubmit` was the only empty slot, and it is the only one that fires
BEFORE a decision. That is where an analysis phase has to live.

Founder, 2026-09-22: *"I don't want to have to remember all the hooks, skills etc
and what order to do them in. I want everything to work together harmoniously."*
So: one phrase in, and the `/build` skill sequences the other nine pieces.

⚠️ THE NOISE PROBLEM IS THE WHOLE DESIGN PROBLEM. Matching the word "build"
would fire on "the build is green", "build-log", "rebuild", "buildings", and on
every mention of `SITE-WAVE-1`'s build. A hook that fires on ordinary
conversation gets switched off, which this repo has recorded TWICE as equivalent
to having no hook (NOISE-GATE-01). So this matches INTENT phrases — an
imperative to start work — and never the bare noun.

Contract: reads the UserPromptSubmit payload on stdin, always exits 0, and emits
`additionalContext` so the procedure is injected rather than blocking anything.
"""
import json
import re
import sys

# ── Intent to START a build. Imperative, first person, or a phase marker. ────
# Each is anchored so it cannot match mid-sentence prose about a past build.
TRIGGERS = [
    r"\blet'?s\s+build\b",
    r"\bbuild\s+phase\b",
    r"\b(?:start|kick\s*off|begin)\s+(?:the\s+)?build\b",
    r"\btime\s+to\s+build\b",
    r"\bbuild\s+it\b",
    r"\bbuild\s+this\b",
    r"\bgo\s+ahead\s+and\s+build\b",
    r"\bwe(?:'re| are)\s+(?:going\s+to\s+|gonna\s+)?build\b",
    r"\bimplement\s+(?:this|it|that|wave|the)\b",
    r"\bcrack\s+on\s+with\s+(?:the\s+)?build\b",
]
TRIGGER_RE = re.compile("|".join(TRIGGERS), re.I)

# ── Phrases that MENTION a build without asking for one. Checked first. ─────
# "Did the build pass?" must never load a 212-line procedure.
NEGATIVE = re.compile(
    r"""(?:
          build\s*[-_]?log            # build-log, build log
        | the\s+build\s+(?:is|was|passed|failed|broke|went)
        | build\s+(?:is|was)\s+(?:green|red|clean|broken|passing|failing)
        | (?:did|has|does)\s+the\s+build
        | rebuild
        | building\s+(?:blocks?|society)
    )""",
    re.I | re.VERBOSE,
)

REMINDER = """🏗️  STANDARD BUILD PROCEDURE — load the `build` skill before any code.

The founder's standing instruction (2026-09-22): this procedure is not to be
re-typed each time. Invoke the `build` skill now and follow it.

The short version, so it cannot be skipped by forgetting to load the skill:

  0. NAME THE INPUT — backlog item / board ruling / RCA / design / founder
     instruction. No named input, no build.
     ⚠️ `/zona-debug` runs BEFORE this, never inside it. A defect needs its RCA
     first.

  1. ANALYSIS, and it PRODUCES A WRITTEN BLOCK before any code:
     · settled ground — design-rulings.md / coaching-rulings.md / ownership-map.md
     · reuse before writing — find the existing function; state the blast radius
     · 🔴 CONSUMER CHECK, APP **AND** WEBSITE — where is this output READ?
       (a number on the site is often the same number in the app)
     · upstream + downstream impact, each named or explicitly "none"
     · route the questions NOW: coaching → /coaching-board · significant UI →
       /design-board · product or tier → /slt-review · UI craft → frontend-design
       (which also runs standalone, on its own merit)
     · new pattern? agree it as architect, land it in ui-patterns.md
     · risks → mitigation · issues found → folded in, or filed with a board tag

  2. BUILD — SLC (all states). Every changed value testable, or documented as
     not. Regression-test the consumers. Falsify any new check before trusting
     it green.

  3. LAND — commit with the item in the SUBJECT'S SCOPE, read the post-commit
     hooks, then /ship (backlog out → feature-registry row + build-log entry).

⚠️ The guards fire on the FILE, which is too late. A coaching or design question
that never touches a doctrine file will not trip a hook. Route it in analysis."""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0  # never interfere on a parse failure

    prompt = payload.get("prompt", "") or ""
    if not prompt:
        return 0
    if NEGATIVE.search(prompt):
        return 0
    if not TRIGGER_RE.search(prompt):
        return 0

    json.dump({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": REMINDER,
        }
    }, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
