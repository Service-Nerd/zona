# Coaching Board RE-SITTING: the easy floor, on corrected evidence (2026-10-27)

**Why:** the morning's ruling (C, 4 km or 35 minutes) rested on a prototype that rounded the floor down and so breached
its own floor; the "77% of overrun relief" was false (see the evidence pack's Correction). Founder: re-sit rather than
build. **Evidence:** `docs/decisions/coaching-2026-10-27-easy-floor-minutes.md`, Correction section, read in full.
**`measure:fitness`:** D changes no cohort or targeted plan, so the harness's populations are unchanged by construction.

## Conflict scan

- **The earlier sitting's C:** its evidence is withdrawn. Its two amendments (one owner; 0 day-count changes) stand
  as conditions on whatever replaces it.
- **§82 / §82 Am.1:** floor protection holds an easy run at its floor against the weekday limit; Am.1 scoped "a few
  minutes" to the magnitude ruled. D changes what the floor IS on that path; the mechanism is unchanged.
- **§81:** long runs and structured sessions are exempt from the limit. D does not touch them (they are the 1,660 left).
- **§52b:** untouched; D does not reach construction. 0 day-count changes measured.
- **§40c:** every plan losing at least 10% of its peak has a limit and already carries the note (83 of 83).
- **S9-DURATION-FLOOR-01 and the checker's own record:** "30 minutes is a real session whatever it converts to", and a
  duration-anchored beginner easy run is already capped to the limit with no floor. D brings distance-anchored slow
  runners to the same treatment, bounded at 30.
- **§9 Amendment (quality, 35 min):** a quality session needs its warm-up and cool-down inside its floor; an easy run
  does not. A different number for a different session is not a contradiction.

## The seats

🏃 **Hutchinson (chair).** I ruled C on a number that was wrong, and the correct number says C does little: it shortens
overruns and never removes one. The question underneath was always narrower than "what is an easy run's floor". It is
"when the runner has told us their weekday, may the floor overrule them?" D answers that in the one place it arises,
and changes nobody else's plan. C is vacated.

📊 **Seiler.** No distribution effect. 30 minutes of easy running is the smallest session I would call training, and
the engine already gives beginners exactly that. No objection to D.

🎯 **McMillan.** This is the version I wanted. A 2.3 km run at 13 minutes a kilometre is 30 minutes on feet, and on a
day they told us gives them 30, that's the session. Holding them at 52 minutes was the plan refusing to listen, and
"any shorter and it stops being a training run" was not true at 30.

🩹 **Willy.** D shortens runs and adds none, and the day count does not move: my condition holds. The weekly volume these
runners lose is their own stated limit, already declared. The declaration gap the sweep found must be closed in the
build, not waived: a held run the plan does not declare is a suppressed target absorbed silently. Supports D at 30.

⚕️ **Sims.** Supports. These are the runners for whom a plan that ignores their time reads as "this isn't for you".

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

None.

## Ruling

| Item | Ruling |
|---|---|
| **C (4 km or 35 min, everywhere)** | **VACATED.** Its evidence was a rounding defect; as worded it removes no overrun. |
| **D, N = 35** | **INCORRECT.** A 35-minute held run is still over a 30-minute limit: the count does not fall. |
| **D, N = 30** | **CORRECT WITH AMENDMENT.** On a capped weekday, a §82 floor-held easy run lasts the runner's limit, or `EASY_FLOOR_HELD_MINS` (30) if the limit is below 30, and never more than the 4 km floor. **Amendments:** (1) construction's easy floor is unchanged (0 cohort / targeted plans move); (2) **0 day-count changes, binding** (Willy); (3) `INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED` and the overrun note recognise the held run, so the plan still declares it (Willy, binding); (4) one owner for the held length, read by the producer and re-derived independently by the checker. |
| **Build gates** | parity, `cohort:shape`, `measure:fitness`, envelope, sweep clean (the declaration gap closed), 0 day-count changes; the 4 live plans dry-run. |

## Artifacts (at build)

| | |
|---|---|
| Principle | §82 Amendment 2: the held run is the runner's limit, at least 30 minutes, at most 4 km |
| Numeric | `GENERATION_CONFIG.EASY_FLOOR_HELD_MINS = 30` |
| Invariant | `INV-PLAN-MIN-SESSION-SIZE` and `INV-PLAN-MAX-WEEKDAY-MINS` accept the held run in either form; falsified on a slow capped plan |

## SLT escalation
None.
