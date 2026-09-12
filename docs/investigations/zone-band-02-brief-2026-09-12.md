# ZONE-BAND-02 — brief for the Coaching Board (NOT YET CONVENED)

**Date:** 2026-09-12 · **Status:** measured, decision-ready, awaiting the founder's word to convene
**Tier:** FREE · **Routing:** Coaching Board — it changes what a runner is told to run

---

## What a runner sees

On one Session Detail card, for a long run with a race-pace finish:

| Element | Reads from | Renders |
|---|---|---|
| Header zone label + `ZoneBar` | `session.zone` | **Zone 2–3**, with both zones lit |
| HR line directly beneath | `session.type` (`'easy'`) | **< 145 bpm** — the Zone 2 ceiling |

So the card names Zone 3 and then tells the runner not to enter it. Both
renderers are behaving correctly; **the session's own two fields disagree**, and
each display owner faithfully reports a different one.

`hr_target` is honest about the aerobic portion and silent about the finish.
`session.zone` describes the whole session including the finish.

## Scale — measured 2026-09-12 on the 621-plan cohort grid

**396 sessions** carry `zone: 'Zone 2–3'`. Every single one:

- has `hr_target: '< 145 bpm'` (the Zone 2 ceiling) — 396 / 396
- is on a **`time_target`** goal — 396 / 396, none on finish-goal plans
- is one of three long runs: *Long run — marathon pace + HM-pace finish* (216),
  *Long run with HM-pace finish* (108), *Marathon-pace long run* (72)

Spread: 5K 108 · 10K 108 · HM 108 · marathon 72. By level: **beginner 198**,
intermediate 99, experienced 99 — so half the affected sessions go to beginners,
the Make-A-Wish cohort.

> ⚠️ **The backlog says "48 sessions". That figure is from the §84 Amendment 1
> sitting's own grid, not this one.** On the 621-plan cohort grid it is 396.
> Neither number is wrong; they are different populations. The board should be
> told which it is ruling on. Nothing here relies on the 48.

## Why it was left out of §84 Amendment 1 (correctly)

That amendment's invariant is deliberately **scoped to RANGE targets**
("145–158 bpm"), not ceilings ("< 145 bpm"). A ceiling is a different claim — it
caps the session rather than describing its span — and for every ordinary Z2
session the display already renders "< top", which agrees. This is the one case
that does not, it is a different mechanism, and the board's sitting covered
quality sessions. It was recorded rather than silently swept in. See
`lib/plan/invariants.ts` ~1064.

---

## The options

**A. The target becomes a range covering the finish.** `hr_target` stops being
the aerobic ceiling and describes the whole session. Honest about the finish;
but it hands a beginner a long run whose stated HR band reaches Zone 3, and the
aerobic portion — the overwhelming majority of the session — loses its ceiling.
Willy and Seiler will have views on what that does to a runner who already
blurs zones, which is the entire product thesis.

**B. The zone string narrows to Zone 2, the finish lives in the structure only.**
The card reads "Zone 2 · < 145 bpm" and the race-pace finish appears in the main
set / `derived_set` where it is already described. Keeps the ceiling honest for
95% of the session's duration; the cost is that the headline no longer signals
the session contains faster running at all.

**C. Split targets per segment.** Uses the v2 `derived_set` structure (ADR-019)
to carry a target per block, so the aerobic portion and the finish each state
their own. Correct in principle and the largest change: it needs a display that
can render two targets on one card without becoming a table, and ADR-019's
targets name a pace anchor rather than a number.

## What is NOT being asked

Whether to make the display stop contradicting itself without a coaching
decision. That was offered and declined — one of the two numbers is wrong on
screen regardless of which option wins, but patching the display first would
prejudge the answer and bank a change the board might reverse.

## Recommended framing for the chair

The question is not "which number is right". It is **whether a long run with a
race-pace finish is one session with one target, or two efforts sharing a slot**
— because A, B and C are just that answer expressed three ways.
