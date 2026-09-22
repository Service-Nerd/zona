#!/usr/bin/env python3
"""Regression tests for build-trigger.py.
Run: python3 .claude/hooks/build-trigger.test.py

Two failure directions, and the SECOND matters more:
  - a real build request not loading the procedure (analysis gets skipped), and
  - firing on ordinary conversation, which gets the hook switched off — recorded
    TWICE in this repo as equivalent to having no hook (NOISE-GATE-01).

The MUST-NOT-FIRE cases are drawn from the founder's own prompts in the session
that created this hook, plus the phrases that surround a build without being one.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bt", os.path.join(HERE, "build-trigger.py"))
bt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bt)

FIRE, QUIET = "fire", "quiet"


def result(prompt: str) -> str:
    if bt.NEGATIVE.search(prompt):
        return QUIET
    return FIRE if bt.TRIGGER_RE.search(prompt) else QUIET


CASES = [
    # ── MUST FIRE — an instruction to start work ─────────────────────────────
    ("let's build",                    "ok let's build wave 1a",                        FIRE),
    ("lets build, no apostrophe",      "lets build the section component",              FIRE),
    ("build phase",                    "right, build phase please",                     FIRE),
    ("start the build",                "start the build",                               FIRE),
    ("kick off the build",             "kick off the build when you're ready",          FIRE),
    ("time to build",                  "time to build it properly",                     FIRE),
    ("build it",                       "ok build it",                                   FIRE),
    ("build this",                     "build this now",                                FIRE),
    ("we're going to build",           "so we're going to build the waves",             FIRE),
    ("we're gonna build",              "when we're gonna build i want this standard",   FIRE),
    ("implement this",                 "implement this ruling",                         FIRE),
    ("implement wave",                 "implement wave 1a",                             FIRE),
    ("go ahead and build",             "go ahead and build the skill",                  FIRE),
    ("crack on with the build",        "crack on with the build",                       FIRE),

    # ── MUST STAY QUIET — the founder's own phrasing this session ────────────
    ("asking about the build-log",     "ensure the backlog and build log is updated",   QUIET),
    ("build-log hyphenated",           "append an entry to the build-log",              QUIET),
    ("status question",                "did the build pass?",                           QUIET),
    ("build is green",                 "the build is green, ship it",                   QUIET),
    ("build was broken",               "the build was broken yesterday",                QUIET),
    ("rebuild",                        "we should rebuild the component later",         QUIET),
    ("a question about procedure",     "what do you recommend and what can we implement?", QUIET),
    ("discussing waves",               "so we've got these waves but then you mentioned", QUIET),
    ("asking the order",               "do we do the waves first and then sitting two",  QUIET),
    ("board talk",                     "take it to the coaching board get an answer",    QUIET),
    ("plain question",                 "what is sitting one's agenda?",                  QUIET),
    ("website review ask",             "I want them to review the website as a collection", QUIET),
    ("wow moments",                    "I'm not clear on the wow moments",               QUIET),
    ("documenting",                    "document where we're at in the backlog",         QUIET),
    ("empty",                          "",                                               QUIET),
]


def main() -> int:
    failures = 0
    for desc, prompt, expected in CASES:
        actual = result(prompt)
        ok = actual == expected
        if not ok:
            failures += 1
        mark = "✓" if ok else "✗"
        print(f"{mark} {desc:<28} → {actual:<5} (want {expected})   {prompt[:44]!r}")

    # Malformed input must never raise.
    for bad in [None, "", "   "]:
        try:
            result(bad or "")
        except Exception as exc:  # pragma: no cover
            failures += 1
            print(f"✗ raised on {bad!r}: {exc}")

    print()
    print(f"{len(CASES)} cases, {failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
