# Coaching Board: race day for a runner whose goal pace was withheld (2026-10-27)

**Trigger:** soft, qualifies: it changes the race-day pacing instruction (§80 Am.1), which is prescription.
**Evidence:** `docs/decisions/coaching-2026-10-27-race-day-withheld.md` (read in full).
**Proposed:** on a plan past the §120 Am. 2 line, the race session's opening line stops telling the runner to open at goal
pace. Options A (unchanged), B (open at current race-fitness pace, goal as a second-half option), C (Zone 2).
**`measure:fitness`:** not run, deliberately: the change is one sentence on the race session; no training session,
volume or plan shape moves, so the harness cannot see it. Stated rather than skipped.

## Conflict scan (sections and amendments)

- **§80 Amendment 1 (2026-09-14):** the opening is `RACE_OPENING_FRACTION` (12%) of the race; a time-targeted race opens
  at goal pace *"which is the pace the entire plan has been rehearsing"*. Past the line that premise is false. Amended
  here for that cohort only; its fraction and its finish-goal Zone 2 arm stand.
- **§120 Amendment 2 (2026-10-27):** past the line, no goal-paced work, and *"sessions are set to what you can run now"*.
  Option A contradicts it on the one session that counts most.
- **§44 Am. 2 / §83 (declare the gap):** the gap is named in the plan note; race day may not unsay it.
- **ADR-014 (recalibration):** forward paces are rewritten on a confirmed time trial; a pace baked into a sentence is not.
  Relevant to how the number is carried, not to whether it is right.
- **§1:** no session count changes. No effect.
- No conflict with the zone model: no zone label is in question.

## The seats

🏃 **Hutchinson (chair).** The evidence is one-directional where it matters: in large marathon datasets roughly three in
four recreational runners positive-split, and the cost of a strong positive split is enormous (about an hour in the
PLOS ONE analysis). Opening a marathon 2:48/km faster than your benchmark predicts is not ambition, it is the start of
that statistic. A is incorrect for this cohort. C under-asks a 5K or 10K, which §80 Am.1 already ruled. B is the
defensible position, with one honesty constraint: the number is a benchmark-based estimate, so the sentence must not
claim more precision than that.

📊 **Seiler.** No distribution effect. The asymmetry is the argument: under-pacing the first 12% costs seconds, over-pacing
it costs the race. The estimate is conservative by construction, because the plan will have trained them for weeks
since the benchmark, so the runner may well finish faster than the opening pace implies, which is the outcome you want.

🎯 **McMillan.** Race the fitness you have, and let the goal come to you late. That is what I tell every amateur with a
stretch target: settle at what your training says, and if halfway feels controlled, that is where you find out about the
goal. **Amendment:** the number must be current on race day. If they ran a time trial in week 8, race day should use
it, so the opening pace has to be carried as data the screen renders, not frozen inside a sentence.

🩹 **Willy.** No load vector worth the name in one race. A fast start in the marathon degrades form late, which is where
I see the calf and Achilles complaints, so B is mildly protective. No objection.

⚕️ **Sims.** The women in this cohort are more likely to hold an even pace already; giving them an honest number helps
everyone. What matters for me is that race day matches what the plan said all along: a runner told "sessions are set to
what you can run now" and then "open at your goal pace" learns that one of those sentences is false. Supports B.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

None of substance. Seiler and McMillan differ on emphasis (Seiler: the estimate is conservative and that is fine;
McMillan: it must update to the latest time trial). Both are satisfied by carrying the pace as data.

## Ruling

| Item | Ruling |
|---|---|
| **Option A** | **INCORRECT for a plan past the line.** It contradicts §120 Am. 2 on race day and is the start that produces positive splits. Inside the line, §80 Am.1 stands unchanged |
| **Option B** | **CORRECT WITH AMENDMENT.** Past the line, the opening `RACE_OPENING_FRACTION` of the race is run at the runner's **current race-fitness pace** (Daniels at the plan's latest VDOT, so a confirmed time trial moves it, McMillan, binding), held even; the goal is offered as a second-half option if the race feels controlled. Founder's words for the sentence; no claim of more precision than a benchmark estimate (chair) |
| **Option C** | **Not for this cohort** (§80 Am.1: Zone 2 gives away a 5K/10K). Stays for finish goals |
| **`race_notes`** | Not this board's question: the field renders nowhere. Filed for the build to resolve (render it or retire it) |

## Artifacts (at build)

| | |
|---|---|
| Principle | §80 Amendment 2: the opening for a runner past the §120 Am. 2 line |
| Numeric | none new: `RACE_OPENING_FRACTION` and `GOAL_PACE_MAX_STRETCH_PCT` already govern it |
| Invariant | `INV-PLAN-GOAL-PACE-REACHABLE` gains a race-day arm: on a withheld plan the race session does not cite goal pace, and its opening pace is within `GOAL_PACE_REHEARSAL_TOLERANCE_PCT` of current race fitness |
| Copy | founder |

## SLT escalation
None.
