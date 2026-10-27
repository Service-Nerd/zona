# Coaching Board: an easy run that becomes a second long run (2026-10-27)

**Trigger:** soft, qualifies. Both questions change what the engine prescribes: Q1 a cap on easy-run size, Q2 the
long-run/easy-run split on duration-anchored plans.
**Evidence:** `docs/decisions/coaching-2026-10-27-easy-run-second-long-run.md` (read in full).
**Proposed:** Q1, cap an easy run that grows to a second long run. Q2, apply §9's 1.25 ratio in minutes on
duration-anchored plans.
**`measure:fitness`:** not run, deliberately. No candidate is prototyped, so there is nothing to measure. It is a gate
on the build (below), not skipped.

## Conflict scan (sections and amendments)

- **§9 (long-run rules):** the long run is at least `LONG_RUN_MIN_RATIO_VS_EASY` × the easy run, and redistribution
  preserves weekly volume. Q2 applies this rule; it does not change it. The rule is written in distance because it
  predates duration-anchored plans, not because time was ruled out.
- **§9 Amendment (2026-10-27):** *"a question about time on feet, not ground covered"*, and beginners are
  duration-anchored. That is direct precedent for Q2.
- **§45 (long-run progression cap, universal):** if Q2 grows the long run, §45 bounds how fast it grows. **That is a
  real conflict to manage, not a contradiction.** The ratio may not be met by breaking §45.
- **§52 (long run ≤ 60% of the week)** and **§9's minute cap:** the same constraint, from above.
- **§40c (a suppressed target is stated, never absorbed):** governs the residual when the long run cannot grow.
- **§52b / §82 / §90:** day-carrying, the weekday floor and the easy-trim floor are untouched. Q2 lowers easy runs
  toward long ÷ 1.25, never below §9's easy floor.
- **§1:** session counts only. No effect.
- Zone model: no zone label in question.

## The seats

🏃 **Hutchinson (chair).** The item described a mechanism, volume piling into one easy run, and the measurement does not
support it. In 72% of flagged weeks every easy run is that size, and the average overshoot of §9's line is half a minute
a week. What the data show is ordinary: a 365-minute week on three or four days, with the long run at its cap, gives
80–100-minute midweek runs. That is a medium-long run, a standard tool for runners who cannot add days, and I will not
cap it on a shape that looks unusual on a chart. The finding underneath it is different: a rule we already hold is
switched off for the population least able to tell. Two 156-minute "easy" runs beside a 157-minute long run is three
long runs, and the plan says otherwise. That is a defect against §9, not a new principle.

📊 **Seiler.** No distribution effect on Q1 or Q2: session counts do not move. One caution on Q1: duration matters for
easy days too, but it matters through total load and recovery between sessions, not through any one easy run's length
relative to the long run. A ratio cap on easy runs would not be measuring the thing that hurts people. No objection to Q2.

🎯 **McMillan.** A 90-minute Wednesday is exactly what I give a four-day half-marathoner who wants 50 km. Capping it
would push the runner to a fifth day they told us they do not have, or cut volume they asked for. Reject the cap. On Q2,
the beginner case is real: nobody coaches a beginner into three near-equal 2.5-hour runs. Fix the split. Also look at the
input: a beginner at 70 km/week on four days is a combination worth a second look, but that is §79's question, not this
one.

🩹 **Willy.** Load sits in the weekly total and in the single biggest exposure. Q1: an evenly spread week with the long
run clearly the longest is a tolerable shape, so no cap from this seat, provided the two biggest sessions are spaced
(INV-PLAN-LARGEST-SESSIONS-SPACED is warn-level and stays). Q2: **binding condition.** Meeting the ratio must never grow
the long run faster than §45 allows or past §9's cap. For a duration-anchored beginner the honest answer, when the long
run cannot grow, is shorter easy runs and fewer minutes that week, stated. Do not trade a too-big easy run for a
too-fast long-run jump.

⚕️ **Sims.** No sex-specific objection to either question. The duration-anchored cohort skews toward newer runners, and
newer women in particular are the group a plan should not quietly overload. Q2 protects them. Support, with Willy's
condition.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

None of substance. McMillan would accept a little more easy volume at the cap rather than drop minutes; Willy holds the
drop when the long run cannot grow. Willy's condition binds (load is his seat). McMillan's point is recorded: the build
measures how many minutes the drop removes, and if the figure is material it comes back here.

## Ruling

| Item | Ruling |
|---|---|
| **Q1, cap a big easy run** | **INCORRECT.** The item's mechanism is measured false (72% evenly spread; 0.5 min/week over §9's line). A medium-long run beside a capped long run is correct coaching for a runner short of days. No cap. The item closes as ruled. |
| **Q2, §9's ratio in minutes** | **CORRECT WITH AMENDMENT.** On a duration-anchored session, `LONG_RUN_MIN_RATIO_VS_EASY` binds in minutes, and the producer redistributes in minutes exactly as it does in km, preserving the week. **Amendment (Willy, binding):** the long run grows only as far as §45, §9's minute cap and §52 allow. Past that, the easy runs are held at long ÷ 1.25 and the residual is dropped and stated (§40c). |
| **Build gates** | `measure:fitness` `neverBuildsPct` stays 0; delivered beginner weekly minutes reported before and after (McMillan's figure); `cohort:shape` re-baselined only with that number declared; `verify:parity` shows only duration-anchored plans move. |

## Artifacts (at build)

| | |
|---|---|
| Principle | §9 Amendment 2: the ratio binds in the plan's own unit |
| Numeric | none new: `LONG_RUN_MIN_RATIO_VS_EASY` (1.25) already governs |
| Invariant | `INV-PLAN-LONG-IS-LONGEST` gains a minutes arm for duration-anchored sessions; falsified on k602 |

## SLT escalation
None.
