# Coaching Board: should the easy floor be 4 km or a time? (2026-10-27)

**Trigger:** hard at build (`generationConfig.ts`, `MIN_SESSION_DISTANCE_KM.easy`'s reading); the change shortens easy
runs for slow runners, which is prescription.
**Evidence:** `docs/decisions/coaching-2026-10-27-easy-floor-minutes.md` (read in full), the evidence the 26 Oct RCA
sitting asked for.
**Proposed:** an easy run meets its floor at 4 km or N minutes at the runner's easy pace. N = 30 (the RCA's candidate)
or N = 35.
**`measure:fitness`:** run on the N = 30 prototype, numbers in the evidence. N = 35 changes no cohort or targeted plan,
so the harness's populations are unchanged by construction.

## Conflict scan (sections and amendments)

- **§9 Amendment (2026-10-27, S9-QUALITY-MINUTES-01):** the quality floor is 5 km or 35 minutes, because a floor asks
  about time on feet. Its own text names this item as unsettled. Extending the reasoning is consistent with it.
- **§82 / §82 Am.1:** floor protection holds an easy run at its floor against a weekday limit, and "a few minutes" is
  bounded by §52b. A time floor bounds the overrun directly; §82's mechanism is unchanged.
- **§52b:** in km, unchanged. ⚠️ **Option B interacts with it**: injury-capped weeks size their easy-run count from the
  easy floor, so a lower floor adds run days (339 weeks). Option C does not (0).
- **§94 Am.3:** frequency is a named load driver. B's 339 extra days are exactly that driver, unmeasured on load.
- **§40c:** every plan losing at least 10% of its peak (all of them with a weekday limit) already carries the note.
- **§1:** session counts. B adds sessions in injury weeks: they are easy, so §1's ratio moves toward easy. No objection,
  noted. C: no effect.
- **§110 / §79:** untouched.

## The seats

🏃 **Hutchinson (chair).** The 26 Oct sitting asked for the measurement, and it changed the question. "4 km or 30
minutes" sounded like a fix for slow runners; it is a rewrite of most beginner plans, because the default beginner easy
pace makes 4 km a 33-minute run. That was not what anyone ruled on. At 35 minutes the change does what the item asked:
it reaches runners slower than 8:45/km, removes three quarters of the weekday overruns, and leaves everyone else exactly
where they are. It also gives the easy run the same time-on-feet floor the quality session got this morning. One number
for one idea.

📊 **Seiler.** No distribution concern with C. B adds easy sessions to injury weeks, which moves §1 toward easy, and I
would not object on distribution grounds. I would object to using a floor change to alter frequency by accident. If
frequency is the lever, rule on it as frequency.

🎯 **McMillan.** A 35-minute easy run is a real session for anyone. For a runner at 13 minutes a kilometre, 4 km is
52 minutes on a weekday they told us gives them 30, and the plan was overruling them. C keeps a 5-minute overrun at a
30-minute limit, which is the "few minutes" §82 Am.1 meant. B would shorten most beginners' easy runs to under half an
hour; I don't think that serves them, and nobody asked for it.

🩹 **Willy.** **I would refuse B as measured.** 339 injury weeks gaining a run day is a frequency increase for injured
runners, delivered as a side effect of a floor, with no load measurement behind it. That is §94 Am.3's driver. C changes
no day count and only shortens runs. The volume drop on the slow grid is the runner's own time limit being honoured,
and the plan already says so. Supports C.

⚕️ **Sims.** The slow runners are disproportionately first-timers and many are women. A plan that keeps scheduling an
hour against a stated half-hour teaches them the plan does not listen. Supports C, and the note already tells them what
the limit costs.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

None of substance. McMillan and Hutchinson would accept a lower N in future if a measurement showed it helped beginners;
Willy's condition is that any N that changes day counts comes back as a frequency question.

## Ruling

| Item | Ruling |
|---|---|
| **A, keep 4 km** | **INCORRECT.** For a slow runner the floor overrides their stated weekday limit by up to 22 minutes a run, unbounded by §52b. |
| **B, 4 km or 30 min** | **INCORRECT as measured.** It changes most beginner plans (1,300 of 3,000 cohort, 882 of 1,500 targeted), which the item never asked, and adds a run day to 339 injury weeks through §52b's interplay, a frequency change for injured runners nobody measured (Willy). |
| **C, 4 km or 35 min** | **CORRECT WITH AMENDMENT.** An easy run meets its floor at 4 km or `EASY_FLOOR_MINS` (35) at the runner's easy pace, whichever is shorter. **Amendments:** (1) the floor is computed once, by its owner (`sessionFloorsFor`), from the runner's easy pace, never re-derived at a call site; (2) **no day count may change** (Willy, binding): the build proves 0 run-day changes on every grid, or it comes back; (3) §52b stays in km. |
| **Build gates** | parity, `cohort:shape`, `measure:fitness` and the envelope moves declared; the sweep clean; 0 day-count changes; the 2 live plans dry-run. |

## Artifacts (at build)

| | |
|---|---|
| Principle | §9 Amendment 3: an easy run meets the floor at 4 km or 35 minutes |
| Numeric | `GENERATION_CONFIG.EASY_FLOOR_MINS = 35`, its own constant: the same value as `QUALITY_FLOOR_MINS` today, ruled for a different session type |
| Invariant | `INV-PLAN-MIN-SESSION-SIZE` accepts an easy run at either form, falsified on a slow-runner plan |

## SLT escalation
None.
